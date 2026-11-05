#!/usr/bin/env node
/**
 * RQ1: history-aware Sentinel Fail vs tree-only baselines Pass.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES } from './secrets.mjs';

const evalRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(evalRoot));
const project = join(repoRoot, 'project');
const fixtures = join(evalRoot, 'fixtures');
const resultsDir = join(evalRoot, 'results');
const cli = join(project, 'src/cli.js');

function run(cmd, args, env = {}) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    env: { ...process.env, ...env, PATH: process.env.PATH },
    maxBuffer: 20 * 1024 * 1024,
  });
}

function sentinel(dir, { history }) {
  const result = run(process.execPath, [cli, dir], {
    SENTINEL_MUSE: 'false',
    SENTINEL_HISTORY: history ? 'true' : 'false',
  });
  let report = null;
  try {
    report = JSON.parse(result.stdout || '{}');
  } catch {
    report = { ok: null, parse_error: true, raw: (result.stdout || '').slice(0, 200) };
  }
  return {
    exit: result.status,
    ok: report?.ok === true,
    fail: report?.ok === false,
    count: report?.count ?? null,
    stderr: (result.stderr || '').slice(0, 400),
  };
}

function gitleaks(dir, { git }) {
  const args = git
    ? ['detect', '-s', dir, '--no-banner', '-r', '/dev/stdout', '-f', 'json']
    : ['detect', '--no-git', '-s', dir, '--no-banner', '-r', '/dev/stdout', '-f', 'json'];
  const result = run('gitleaks', args);
  // gitleaks exits 1 when leaks found, 0 when clean
  let findings = [];
  const out = (result.stdout || '').trim();
  if (out) {
    try {
      const parsed = JSON.parse(out);
      findings = Array.isArray(parsed) ? parsed : [];
    } catch {
      // sometimes NDJSON
      findings = out.split('\n').filter(Boolean).map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    }
  }
  return {
    exit: result.status,
    fail: result.status === 1 || findings.length > 0,
    ok: result.status === 0 && findings.length === 0,
    count: findings.length,
    stderr: (result.stderr || '').slice(0, 400),
  };
}

if (!existsSync(join(fixtures, 'index.json'))) {
  process.stderr.write('Fixtures missing. Run: node scripts/build-history-fixtures.mjs\n');
  process.exit(1);
}

const gitleaksCheck = run('gitleaks', ['version']);
if (gitleaksCheck.status !== 0) {
  process.stderr.write('gitleaks not on PATH. brew install gitleaks\n');
  process.exit(1);
}

mkdirSync(resultsDir, { recursive: true });
const rows = [];

for (const c of CASES) {
  const dir = join(fixtures, c.id);
  if (!existsSync(dir)) {
    rows.push({ id: c.id, error: 'missing fixture' });
    continue;
  }
  const sHist = sentinel(dir, { history: true });
  const sTree = sentinel(dir, { history: false });
  const gTree = gitleaks(dir, { git: false });
  const gGit = gitleaks(dir, { git: true });

  const expectHistFail = c.expect_sentinel_history === 'fail';
  const expectTreePass = c.expect_tree_only === 'pass';

  const rq1_hit =
    expectHistFail && expectTreePass
      ? sHist.fail && sTree.ok && gTree.ok
      : c.control
        ? sHist.ok && sTree.ok
        : null;

  rows.push({
    id: c.id,
    family: c.family,
    control: !!c.control,
    expect_sentinel_history: c.expect_sentinel_history,
    expect_tree_only: c.expect_tree_only,
    sentinel_history: { fail: sHist.fail, ok: sHist.ok, count: sHist.count, exit: sHist.exit },
    sentinel_tree: { fail: sTree.fail, ok: sTree.ok, count: sTree.count, exit: sTree.exit },
    gitleaks_tree: { fail: gTree.fail, ok: gTree.ok, count: gTree.count, exit: gTree.exit },
    gitleaks_git: { fail: gGit.fail, ok: gGit.ok, count: gGit.count, exit: gGit.exit },
    rq1_pattern: rq1_hit, // true = history Fail + tree Pass (sentinel hist + sentinel tree + gitleaks tree)
    notes: c.notes,
  });

  const mark = rq1_hit === true ? 'OK' : rq1_hit === false ? 'MISS' : c.control ? (sHist.ok ? 'CTRL-OK' : 'CTRL-BAD') : '?';
  process.stdout.write(`${mark.padEnd(8)} ${c.id}  sH=${sHist.fail ? 'F' : 'P'} sT=${sTree.fail ? 'F' : 'P'} gT=${gTree.fail ? 'F' : 'P'} gG=${gGit.fail ? 'F' : 'P'}\n`);
}

const leakCases = rows.filter((r) => !r.control && !r.error);
const hits = leakCases.filter((r) => r.rq1_pattern === true).length;
const summary = {
  generated_at: new Date().toISOString(),
  gitleaks: (gitleaksCheck.stdout || gitleaksCheck.stderr || '').trim(),
  n_leak_cases: leakCases.length,
  n_rq1_hits: hits,
  rq1_rate: leakCases.length ? hits / leakCases.length : 0,
  n_control_pass: rows.filter((r) => r.control && r.sentinel_history?.ok).length,
  rows,
};

writeFileSync(join(resultsDir, 'rq1.json'), JSON.stringify(summary, null, 2));

const md = [
  '# RQ1 results',
  '',
  `Generated: ${summary.generated_at}`,
  `Gitleaks: ${summary.gitleaks}`,
  '',
  `**History-leak cases:** ${summary.n_leak_cases}`,
  `**RQ1 pattern (Sentinel history Fail ∧ Sentinel tree Pass ∧ Gitleaks tree Pass):** ${summary.n_rq1_hits}/${summary.n_leak_cases} (${(summary.rq1_rate * 100).toFixed(1)}%)`,
  '',
  '| Case | Sent hist | Sent tree | Gitleaks tree | Gitleaks git | RQ1 |',
  '|------|-----------|-----------|---------------|--------------|-----|',
  ...rows.map((r) => {
    if (r.error) return `| ${r.id} | err | | | | |`;
    const cell = (x) => (x.fail ? `Fail(${x.count})` : 'Pass');
    const rq = r.control ? 'control' : r.rq1_pattern ? 'yes' : 'no';
    return `| ${r.id} | ${cell(r.sentinel_history)} | ${cell(r.sentinel_tree)} | ${cell(r.gitleaks_tree)} | ${cell(r.gitleaks_git)} | ${rq} |`;
  }),
  '',
  '## Notes',
  '',
  '- RQ1 targets **tree/diff-only** miss after delete-from-HEAD.',
  '- `gitleaks git` may also Fail (history-capable); reported for honesty, not as the RQ1 baseline.',
  '',
].join('\n');

writeFileSync(join(resultsDir, 'rq1.md'), md);
writeFileSync(join(evalRoot, 'results.md'), md);
process.stdout.write(`\nRQ1: ${hits}/${leakCases.length} (${(summary.rq1_rate * 100).toFixed(1)}%) → results/rq1.md\n`);
