// Layer-2 eval: scan curated PRs (eval/prs.json), score signals + verdicts.
// Usage: node eval/ai-signals.mjs [--write] [--limit N]
// Needs MODEL_API_KEY in project/.env for verdicts (else Layer-1 only).
// Stops gracefully when GitHub core rate budget runs low.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from '../src/env.js';
import { scanRemote } from '../../web/lib/remote-scan.js';

const here = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(here, '..', '.env'));

const write = process.argv.includes('--write');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg === -1 ? Infinity : Number(process.argv[limitArg + 1]) || Infinity;
const fileArg = process.argv.indexOf('--file');
const listPath = fileArg === -1 ? join(here, 'prs.json') : join(here, process.argv[fileArg + 1]);

async function coreRemaining() {
  const headers = { 'User-Agent': 'sentinel-eval', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch('https://api.github.com/rate_limit', { headers });
  const body = await res.json();
  return body?.resources?.core?.remaining ?? 0;
}

function score(entry, report) {
  const signals = (report.findings || []).filter((f) => f.advisory).map((f) => `${f.rule}:${f.masked}`);
  const verdict = report.muse?.assessment?.verdict || null;
  if (entry.expected === 'agent') {
    if (!signals.length) return { outcome: 'error', detail: 'no Layer-1 signals on an agent PR' };
    if (verdict === 'likely_agent' || verdict === 'mixed') return { outcome: 'correct', detail: verdict };
    if (!verdict) return { outcome: 'abstain', detail: 'no key; Layer 1 only' };
    return { outcome: verdict === 'unclear' ? 'abstain' : 'error', detail: verdict };
  }
  if (!signals.length) return { outcome: 'correct', detail: 'silent on human PR' };
  if (!verdict) return { outcome: 'warn', detail: `${signals.length} signal(s), no verdict (no key)` };
  if (verdict === 'likely_human' || verdict === 'unclear') return { outcome: 'warn', detail: `${signals.length} signal(s), verdict ${verdict}` };
  return { outcome: 'error', detail: `false alarm: ${verdict} with ${signals.length} signal(s)` };
}

const entries = JSON.parse(readFileSync(listPath, 'utf8')).slice(0, limit);
const results = [];
let stopped = null;
for (const entry of entries) {
  await new Promise((r) => setTimeout(r, 1000)); // pace PRs: back-to-back scans trip GitHub abuse limits
  const remaining = await coreRemaining();
  if (remaining < 12) {
    stopped = `GitHub core budget low (${remaining} left); run the rest later.`;
    break;
  }
  try {
    const report = await scanRemote(entry.url);
    const judged = score(entry, report);
    results.push({
      url: entry.url,
      expected: entry.expected,
      blocking: report.count,
      advisory: report.advisory,
      signals: (report.findings || []).filter((f) => f.advisory).map((f) => `${f.rule}:${f.masked}`),
      verdict: report.muse?.assessment || null,
      usage: report.muse?.assessment ? { spark: report.muse.assessment.usage, wonder: report.muse.assessment.usage_wonder } : null,
      ...judged,
    });
    console.log(`${judged.outcome.toUpperCase().padEnd(8)} ${entry.expected.padEnd(6)} ${entry.url} :: ${judged.detail}`);
  } catch (error) {
    results.push({ url: entry.url, expected: entry.expected, outcome: 'error', detail: `scan failed: ${error.message}` });
    console.log(`ERROR    ${entry.expected.padEnd(6)} ${entry.url} :: scan failed: ${error.message}`);
  }
}

const tally = {};
for (const row of results) tally[row.outcome] = (tally[row.outcome] || 0) + 1;
let inTok = 0;
let outTok = 0;
for (const row of results) {
  for (const u of [row.usage?.spark, row.usage?.wonder]) {
    if (!u) continue;
    inTok += u.input_tokens || 0;
    outTok += u.output_tokens || 0;
  }
}
console.log(`\ntally: ${JSON.stringify(tally)} tokens: ${inTok} in / ${outTok} out`);
if (stopped) console.log(stopped);

if (write) {
  const dir = join(here, 'results');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  const path = join(dir, `ai-signals-${stamp}.json`);
  writeFileSync(path, JSON.stringify({ date: stamp, tally, tokens: { in: inTok, out: outTok }, stopped, results }, null, 2));
  console.log(`wrote ${path}`);
}
