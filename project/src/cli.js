#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotationText, summaryText } from './annotate.js';
import { renderComment } from './comment.js';
import { loadEnvFile } from './env.js';
import { applyIgnore, loadIgnore } from './ignore.js';
import { assessAiSignals, reviewFindings } from './muse.js';
import { configuredSecrets, redactText, scrubFindings } from './redact.js';
import { toSarif } from './sarif.js';
import { dedupe, markTreePresence, scanGitHistory, scanPrDiff, scanStaged, scanWorkingTree } from './scan.js';

function applyStrict(findings, env) {
  if (env.SENTINEL_AI_STRICT !== 'true') return findings;
  for (const finding of findings) {
    if (finding.advisory) {
      finding.advisory = false;
      finding.severity = 'low';
    }
  }
  return findings;
}

async function finishReport(raw, root, env, secrets) {
  const { kept, suppressed } = applyIgnore(raw, loadIgnore(root));
  const findings = applyStrict(scrubFindings(kept, secrets), env);
  const blocking = findings.filter((finding) => !finding.advisory);
  const muse = await reviewFindings(findings, { env });
  if (muse) {
    muse.assessment = await assessAiSignals(findings, { env });
    if (muse.assessment) muse.comment = renderComment(findings, muse.labels, muse);
  }
  return {
    ok: blocking.length === 0,
    count: blocking.length,
    advisory: findings.length - blocking.length,
    suppressed: suppressed.length,
    findings,
    muse,
  };
}

export async function collectReport(root, env = process.env) {
  loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'), env);
  const secrets = configuredSecrets(env);
  if (env.SENTINEL_STAGED === 'true') {
    return finishReport(dedupe(markTreePresence(scanStaged(root), [])), root, env, secrets);
  }
  const history = env.SENTINEL_HISTORY !== 'false';
  const maxCommits = env.SENTINEL_MAX_COMMITS || 200;
  const tree = scanWorkingTree(root);
  const rest = [
    ...(history ? scanGitHistory(root, { maxCommits }) : []),
    ...scanPrDiff(root, env.SENTINEL_BASE || '', env.SENTINEL_HEAD || ''),
  ];
  return finishReport(dedupe(markTreePresence([...tree, ...rest], tree)), root, env, secrets);
}

const USAGE = `PR Diff Sentinel: deterministic secret gate on the working tree, PR diff, and git history.

Usage:
  node src/cli.js [root] [--staged] [--sarif]

--staged scans only the staged diff (what the pre-commit hook checks).
--sarif prints SARIF 2.1.0 instead of the JSON report.

Exit 1 means the gate failed. Exit 0 means no findings.
`;

export async function run(argv = process.argv.slice(2)) {
  loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const positionals = argv.filter((arg) => !arg.startsWith('--'));
  if (flags.has('--help') || positionals[0] === 'help') {
    process.stdout.write(USAGE);
    return;
  }
  const root = positionals[0] || '.';
  const env = { ...process.env };
  if (flags.has('--staged')) env.SENTINEL_STAGED = 'true';
  const report = await collectReport(root, env);
  const secrets = configuredSecrets();
  process.stderr.write(redactText(summaryText(report) + annotationText(report), secrets));
  const out = flags.has('--sarif') ? toSarif(report) : JSON.stringify(report, null, 2);
  process.stdout.write(`${redactText(out, secrets)}\n`);
  process.exit(report.count ? 1 : 0);
}

function startedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (startedDirectly()) {
  run().catch(() => {
    process.stderr.write('PR Diff Sentinel failed before finishing the scan.\n');
    process.exit(1);
  });
}
