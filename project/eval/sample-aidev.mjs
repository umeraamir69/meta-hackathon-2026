// Sample ~200 agent + ~200 human PRs from AIDev (hao-li/AIDev) for the full eval.
// Usage: node eval/sample-aidev.mjs [--agents N] [--humans N] [--seed S]
// Writes eval/prs-full.json in the ai-signals.mjs harness format.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DS = 'hao-li/AIDev';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : Number(process.argv[i + 1]) || fallback;
}
const N_AGENT = arg('--agents', 200);
const N_HUMAN = arg('--humans', 200);
const SEED = arg('--seed', 20261028);

function mulberry32(a) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rows(config, offset, length) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${DS}&config=${config}&split=train&offset=${offset}&length=${length}`;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await fetch(url);
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') || 30) * 1000;
      console.log(`429, waiting ${Math.round(wait / 1000)}s (attempt ${attempt})`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      if (res.status >= 500 && attempt >= 2) throw new Error(`HTTP ${res.status}`);
      if (attempt === 8) throw new Error(`HTTP ${res.status}`);
      await sleep(2000 * attempt);
      continue;
    }
    const body = await res.json();
    if (body.rows) return body.rows.map((r) => r.row);
    throw new Error(`no rows: ${JSON.stringify(body).slice(0, 120)}`);
  }
  throw new Error('exhausted retries');
}

function toEntry(row, expected) {
  const url = row.html_url || '';
  const m = url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/?$/);
  if (!m) return null;
  return {
    url: url.replace(/\/$/, ''),
    expected,
    agent: row.agent || null,
    repo: row.repo_url || null,
    user: row.user || null,
    title: (row.title || '').slice(0, 120),
  };
}

// --- agent PRs: stratified chunk offsets across pull_request (361,296 rows) ---
const AGENT_N = 361296;
const agents = [];
const seenAgent = new Set();
const agentRepo = {};
const agentMix = {};
let agentTries = 0;
while (agents.length < N_AGENT && agentTries < 60) {
  const slot = Math.floor(rand() * 40);
  const lo = Math.floor((slot / 40) * AGENT_N);
  const hi = Math.floor(((slot + 1) / 40) * AGENT_N);
  const offset = lo + Math.floor(rand() * Math.max(1, hi - lo - 12));
  const chunk = await rows('pull_request', offset, 12);
  await sleep(1200);
  agentTries += 1;
  for (const row of chunk) {
    if (agents.length >= N_AGENT) break;
    if (!row || !row.agent) continue;
    const entry = toEntry(row, 'agent');
    if (!entry || seenAgent.has(entry.url)) continue;
    const rc = agentRepo[entry.repo] || 0;
    if (rc >= 3) continue; // cap 3 PRs per repo for diversity
    seenAgent.add(entry.url);
    agentRepo[entry.repo] = rc + 1;
    agents.push(entry);
    agentMix[row.agent] = (agentMix[row.agent] || 0) + 1;
  }
}
console.log(`agents: ${agents.length}/${N_AGENT} in ${agentTries} chunks, repos: ${Object.keys(agentRepo).length} mix: ${JSON.stringify(agentMix)}`);

// --- human PRs: random chunks of all_pull_request (7,685,281 rows), keep null-agent ---
const ALL_N = 7685281;
const humans = [];
const seenHuman = new Set();
const repoCount = {};
const rejectMix = {};
let chunks = 0;
let scanned = 0;
let skipped = 0;
let tries = 0;
while (humans.length < N_HUMAN && tries < 150) {
  tries += 1;
  const offset = Math.floor(rand() * (ALL_N - 15));
  let chunk;
  try {
    chunk = await rows('all_pull_request', offset, 15);
  } catch (error) {
    skipped += 1; // some row groups exceed the server scan limit; try another offset
    console.log(`human chunk skipped (${error.message}), try ${tries}, skipped ${skipped}`);
    await sleep(2000);
    continue;
  }
  await sleep(1200);
  chunks += 1;
  scanned += chunk.length;
  for (const row of chunk) {
    if (humans.length >= N_HUMAN) break;
    if (row.agent) {
      rejectMix[row.agent] = (rejectMix[row.agent] || 0) + 1;
      continue;
    }
    const entry = toEntry(row, 'human');
    if (!entry || seenHuman.has(entry.url)) continue;
    const rc = repoCount[entry.repo] || 0;
    if (rc >= 3) continue; // cap 3 PRs per repo for diversity
    seenHuman.add(entry.url);
    repoCount[entry.repo] = rc + 1;
    humans.push(entry);
  }
}
console.log(`humans: ${humans.length}/${N_HUMAN} from ${scanned} scanned in ${chunks} chunks, repos: ${Object.keys(repoCount).length}`);
console.log(`human null-agent density: ${(humans.length / Math.max(1, scanned) * 100).toFixed(1)}% rejects: ${JSON.stringify(rejectMix)}`);

const out = [...agents, ...humans];
const path = join(here, 'prs-full.json');
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(`wrote ${path} (${out.length} entries, seed ${SEED})`);
if (agents.length < N_AGENT || humans.length < N_HUMAN) {
  console.log(`SHORT: agents ${agents.length}/${N_AGENT}, humans ${humans.length}/${N_HUMAN}`);
  process.exitCode = 2;
}
