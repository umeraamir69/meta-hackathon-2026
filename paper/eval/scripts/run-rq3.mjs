#!/usr/bin/env node
/**
 * RQ3: Muse never changes Pass/Fail.
 * For each H1 fixture, compare collectReport with Muse off vs Muse on.
 * Expect identical `ok` (and exit semantics) on every case.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReport } from '../../../project/src/cli.js';
import { CASES } from './secrets.mjs';
import { loadProjectEnv } from './load-env.mjs';

const evalRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtures = join(evalRoot, 'fixtures');
const resultsDir = join(evalRoot, 'results');

const envInfo = loadProjectEnv();
if (!envInfo.has_model_api_key) {
  process.stderr.write('MODEL_API_KEY missing in project/.env — cannot run RQ3 with live Muse.\n');
  process.exit(1);
}

if (!existsSync(join(fixtures, 'index.json'))) {
  process.stderr.write('Fixtures missing. Run: node scripts/build-history-fixtures.mjs\n');
  process.exit(1);
}

mkdirSync(resultsDir, { recursive: true });

const baseEnv = {
  ...process.env,
  SENTINEL_MUSE_TIMEOUT_MS: process.env.SENTINEL_MUSE_TIMEOUT_MS || '60000',
  SENTINEL_HISTORY: 'true',
};

const rows = [];
let flips = 0;
let museLive = 0;
let museLocal = 0;

process.stdout.write(`RQ3 using MODEL_API_KEY (len=${envInfo.key_len})\n`);

for (const c of CASES) {
  const dir = join(fixtures, c.id);
  if (!existsSync(dir)) {
    rows.push({ id: c.id, error: 'missing fixture' });
    continue;
  }

  process.stdout.write(`… ${c.id} `);

  const off = await collectReport(dir, { ...baseEnv, SENTINEL_MUSE: 'false' });
  const on = await collectReport(dir, { ...baseEnv, SENTINEL_MUSE: 'true' });

  const provider = on.muse?.classifier?.provider || on.muse?.provider || null;
  if (provider === 'muse-spark' || provider === 'meta-model-api' || String(provider || '').includes('muse')) {
    museLive += 1;
  } else if (on.muse) {
    museLocal += 1;
  }

  const flipped = off.ok !== on.ok;
  if (flipped) flips += 1;

  rows.push({
    id: c.id,
    control: !!c.control,
    ok_muse_off: off.ok,
    ok_muse_on: on.ok,
    count_off: off.count,
    count_on: on.count,
    flipped,
    muse_provider: provider,
    muse_model: on.muse?.classifier?.model || on.muse?.model || null,
    label_count: on.muse?.labels?.length ?? 0,
  });

  process.stdout.write(`${flipped ? 'FLIP' : 'ok'}  off=${off.ok} on=${on.ok} muse=${provider || 'none'}\n`);
}

const summary = {
  generated_at: new Date().toISOString(),
  key_present: true,
  key_len: envInfo.key_len,
  n_cases: rows.filter((r) => !r.error).length,
  n_flips: flips,
  muse_live_runs: museLive,
  muse_local_fallback_runs: museLocal,
  pass: flips === 0,
  rows,
};

writeFileSync(join(resultsDir, 'rq3.json'), JSON.stringify(summary, null, 2));

const md = [
  '# RQ3 results — Muse cannot change Pass/Fail',
  '',
  `Generated: ${summary.generated_at}`,
  `MODEL_API_KEY present: yes (length ${summary.key_len}; value never logged)`,
  '',
  `**Cases:** ${summary.n_cases}`,
  `**Flips (ok off ≠ ok on):** ${summary.n_flips}`,
  `**Verdict:** ${summary.pass ? 'PASS — 0 flips' : 'FAIL — Muse changed gate'}`,
  `Muse live provider runs: ${summary.muse_live_runs}`,
  `Local-fallback muse runs: ${summary.muse_local_fallback_runs}`,
  '',
  '| Case | ok Muse off | ok Muse on | Flip | Muse provider | Labels |',
  '|------|-------------|------------|------|---------------|--------|',
  ...rows.map((r) => {
    if (r.error) return `| ${r.id} | err | | | | |`;
    return `| ${r.id} | ${r.ok_muse_off} | ${r.ok_muse_on} | ${r.flipped ? 'YES' : 'no'} | ${r.muse_provider || '—'} | ${r.label_count} |`;
  }),
  '',
  '## Method',
  '',
  '1. `collectReport(dir)` with `SENTINEL_MUSE=false`.',
  '2. Same with `SENTINEL_MUSE=true` (Spark + Wonder via Meta Model API).',
  '3. Compare boolean `report.ok` only. Findings counts should match; Muse may only add labels/notes.',
  '',
].join('\n');

writeFileSync(join(resultsDir, 'rq3.md'), md);
process.stdout.write(`\nRQ3: ${flips} flips / ${summary.n_cases} → results/rq3.md (${summary.pass ? 'PASS' : 'FAIL'})\n`);
process.exit(summary.pass ? 0 : 1);
