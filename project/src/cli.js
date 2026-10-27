#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotationText, summaryText } from './annotate.js';
import { loadEnvFile } from './env.js';
import { applyIgnore, loadIgnore } from './ignore.js';
import { reviewFindings } from './muse.js';
import { configuredSecrets, redactText, scrubFindings } from './redact.js';
import { dedupe, scanGitHistory, scanPrDiff, scanWorkingTree } from './scan.js';

export async function collectReport(root, env = process.env) {
  loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));
  const secrets = configuredSecrets(env);
  const history = env.SENTINEL_HISTORY !== 'false';
  const maxCommits = env.SENTINEL_MAX_COMMITS || 200;
  const raw = dedupe([
    ...scanWorkingTree(root),
    ...(history ? scanGitHistory(root, { maxCommits }) : []),
    ...scanPrDiff(root, env.SENTINEL_BASE || '', env.SENTINEL_HEAD || ''),
  ]);
  const { kept, suppressed } = applyIgnore(raw, loadIgnore(root));
  const findings = scrubFindings(kept, secrets);
  const muse = await reviewFindings(findings, { env });
  return {
    ok: findings.length === 0,
    count: findings.length,
    suppressed: suppressed.length,
    findings,
    muse,
  };
}

export async function run() {
  const root = process.argv[2] || '.';
  const report = await collectReport(root);
  const secrets = configuredSecrets();
  process.stderr.write(redactText(summaryText(report) + annotationText(report), secrets));
  process.stdout.write(`${redactText(JSON.stringify(report, null, 2), secrets)}\n`);
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
