#!/usr/bin/env node
/**
 * RQ2: Muse Spark label agreement vs fixture ground truth.
 * Uses classifyFindings (Spark) only — Wonder not required for labels.
 * Ground truth: author-verified labels from fixture construction (see secrets.mjs).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReport } from '../../../project/src/cli.js';
import { classifyFindings } from '../../../project/src/muse.js';
import { CASES } from './secrets.mjs';
import { loadProjectEnv } from './load-env.mjs';

const evalRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtures = join(evalRoot, 'fixtures');
const resultsDir = join(evalRoot, 'results');

const envInfo = loadProjectEnv();
if (!envInfo.has_model_api_key) {
  process.stderr.write('MODEL_API_KEY missing in project/.env — cannot run RQ2 Spark.\n');
  process.exit(1);
}

if (!existsSync(join(fixtures, 'index.json'))) {
  process.stderr.write('Fixtures missing. Run: node scripts/build-history-fixtures.mjs\n');
  process.exit(1);
}

mkdirSync(resultsDir, { recursive: true });
mkdirSync(join(evalRoot, 'cache'), { recursive: true });

const baseEnv = {
  ...process.env,
  SENTINEL_MUSE_TIMEOUT_MS: process.env.SENTINEL_MUSE_TIMEOUT_MS || '60000',
  SENTINEL_HISTORY: 'true',
  SENTINEL_CLASSIFIER: process.env.SENTINEL_CLASSIFIER || 'muse-spark-1.3',
};

function fingerprint(finding) {
  const raw = finding.fingerprint || `${finding.rule}|${finding.path}|${finding.masked}|${finding.source}`;
  return createHash('sha256').update(String(raw)).digest('hex').slice(0, 16);
}

const rows = [];
const confusion = {};

function bump(gt, pred) {
  const key = `${gt}→${pred}`;
  confusion[key] = (confusion[key] || 0) + 1;
}

process.stdout.write(`RQ2 Spark labeling (key len=${envInfo.key_len})\n`);

for (const c of CASES) {
  if (c.control) continue;
  const dir = join(fixtures, c.id);
  if (!existsSync(dir)) {
    rows.push({ case_id: c.id, error: 'missing fixture' });
    continue;
  }

  process.stdout.write(`… ${c.id} `);

  const report = await collectReport(dir, { ...baseEnv, SENTINEL_MUSE: 'false' });
  const blocking = (report.findings || []).filter((f) => !f.advisory);
  if (!blocking.length) {
    process.stdout.write('no findings\n');
    rows.push({ case_id: c.id, error: 'expected findings', ok: report.ok });
    continue;
  }

  const classified = await classifyFindings(blocking, {
    env: { ...baseEnv, SENTINEL_MUSE: 'true' },
  });

  // alignLabels zips 1:1 with the findings array passed to classifyFindings
  const labels = classified.labels || [];
  const provider = classified.provider;
  for (let i = 0; i < blocking.length; i++) {
    const finding = blocking[i];
    const sparkLabel = labels[i]?.label || 'unclear';
    const gt = c.ground_truth_label;
    const agree = sparkLabel === gt;
    bump(gt, sparkLabel);
    rows.push({
      finding_id: `${c.id}#${i}`,
      case_id: c.id,
      rule: finding.rule,
      path: finding.path,
      source: finding.source,
      fingerprint: fingerprint(finding),
      masked: finding.masked ? String(finding.masked).slice(0, 24) : null,
      human_label: gt,
      spark_label: sparkLabel,
      agree,
      spark_provider: labels[i]?.provider || provider,
      spark_model: classified.model || null,
      why: labels[i]?.why ? String(labels[i].why).slice(0, 160) : null,
    });
  }

  const n = blocking.length;
  const hits = rows.filter((r) => r.case_id === c.id && r.agree).length;
  process.stdout.write(`${provider} ${hits}/${n} agree\n`);
}

const labeled = rows.filter((r) => r.human_label && r.spark_label);
const agrees = labeled.filter((r) => r.agree).length;
const accuracy = labeled.length ? agrees / labeled.length : 0;

const summary = {
  generated_at: new Date().toISOString(),
  key_len: envInfo.key_len,
  classifier: baseEnv.SENTINEL_CLASSIFIER,
  n_findings: labeled.length,
  n_agree: agrees,
  accuracy,
  confusion,
  rows: labeled,
};

writeFileSync(join(resultsDir, 'rq2.json'), JSON.stringify(summary, null, 2));

// CSV without raw secrets (masked only)
const csvHeader = 'finding_id,case_id,rule,path,source,fingerprint,human_label,spark_label,agree,spark_provider\n';
const csvBody = labeled.map((r) => [
  r.finding_id, r.case_id, r.rule, r.path, r.source, r.fingerprint,
  r.human_label, r.spark_label, r.agree, r.spark_provider,
].map((x) => `"${String(x ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
writeFileSync(join(resultsDir, 'labels.csv'), csvHeader + csvBody + '\n');

const md = [
  '# RQ2 results — Muse Spark vs human (fixture GT)',
  '',
  `Generated: ${summary.generated_at}`,
  `Classifier: ${summary.classifier}`,
  `MODEL_API_KEY: present (len ${summary.key_len})`,
  '',
  `**Findings labeled:** ${summary.n_findings}`,
  `**Agreement:** ${summary.n_agree}/${summary.n_findings} (${(accuracy * 100).toFixed(1)}%)`,
  '',
  '## Confusion (human→spark)',
  '',
  ...Object.entries(confusion).map(([k, v]) => `- ${k}: ${v}`),
  '',
  '## Per finding',
  '',
  '| ID | Rule | Human | Spark | Agree |',
  '|----|------|-------|-------|-------|',
  ...labeled.map((r) => `| ${r.finding_id} | ${r.rule} | ${r.human_label} | ${r.spark_label} | ${r.agree ? 'yes' : 'no'} |`),
  '',
  '## Ground-truth policy',
  '',
  '- `likely_example`: AWS documentation example material (h01, h15).',
  '- `likely_live`: other synthetic live-shaped secrets in H1.',
  '- Labels are author-verified from fixture construction (see `scripts/secrets.mjs`).',
  '- CSV: `results/labels.csv` (fingerprints + masked only; no raw secrets).',
  '',
].join('\n');

writeFileSync(join(resultsDir, 'rq2.md'), md);
process.stdout.write(`\nRQ2: ${agrees}/${labeled.length} (${(accuracy * 100).toFixed(1)}%) → results/rq2.md\n`);
