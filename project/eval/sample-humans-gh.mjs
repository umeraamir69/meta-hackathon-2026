// Sample ~200 human PRs via the GitHub API and merge into eval/prs-full.json.
// Usage: node eval/sample-humans-gh.mjs [--humans N]
// Needs GITHUB_TOKEN in project/.env. Skips bots and agent-looking PRs.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from '../src/env.js';

const here = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(here, '..', '.env'));

const N = Number(process.argv[process.argv.indexOf('--humans') + 1] || 200) || 200;
const PER_REPO = 5;

// Diverse, human-driven, high-PR-volume repos (+ spares at the end).
const REPOS = [
  'curl/curl', 'nodejs/node', 'python/cpython', 'rust-lang/rust', 'golang/go',
  'microsoft/vscode', 'facebook/react', 'django/django', 'rails/rails',
  'kubernetes/kubernetes', 'hashicorp/terraform', 'ansible/ansible',
  'elastic/elasticsearch', 'git/git', 'vim/vim', 'neovim/neovim',
  'pytest-dev/pytest', 'psf/requests', 'pallets/flask', 'expressjs/express',
  'webpack/webpack', 'babel/babel', 'eslint/eslint', 'prettier/prettier',
  'vercel/next.js', 'sveltejs/svelte', 'vuejs/core', 'angular/angular',
  'spring-projects/spring-boot', 'apache/kafka', 'redis/redis', 'postgres/postgres',
  'torvalds/linux', 'apple/swift', 'dotnet/runtime', 'flutter/flutter',
  'kubernetes/kubectl', 'helm/helm', 'prometheus/prometheus', 'grafana/grafana',
  // spares for top-up
  'mui/material-ui', 'tailwindlabs/tailwindcss', 'lodash/lodash', 'axios/axios',
  'celery/celery', 'guardian/frontend', 'elastic/kibana', 'mongodb/mongo',
];

const BOT_LOGIN = /(\[bot\]|bot$|dependabot|renovate|greenkeeper|snyk-bot|codecov|coveralls|travis|jenkins|bors|rust-highfive|github-actions)/i;
const AGENT_REF = /(copilot|codex|cursor|aider|devin|claude|swe-agent|opencode|gemini-cli)/i;
const AGENT_TRAILER = /co-authored-by:\s*.*(copilot|codex|cursor|claude|devin|gemini|chatgpt|openai|anthropic)/i;

const headers = {
  'User-Agent': 'sentinel-eval',
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
};

function looksHuman(pr) {
  if (!pr.merged_at) return false;
  const login = pr.user?.login || '';
  if (pr.user?.type !== 'User') return false;
  if (BOT_LOGIN.test(login)) return false;
  if (AGENT_REF.test(pr.head?.ref || '')) return false;
  if (AGENT_TRAILER.test(pr.body || '')) return false;
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const humans = [];
const seen = new Set();
for (const repo of REPOS) {
  if (humans.length >= N) break;
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=closed&per_page=100`, { headers });
  if (!res.ok) {
    console.log(`${repo}: HTTP ${res.status}, skipped`);
    continue;
  }
  const prs = (await res.json()).filter(looksHuman);
  // spread picks across the page for time diversity
  const picks = [];
  for (let i = 0; i < prs.length && picks.length < PER_REPO; i += Math.max(1, Math.floor(prs.length / PER_REPO))) {
    const pr = prs[i];
    if (!seen.has(pr.html_url)) {
      seen.add(pr.html_url);
      picks.push({
        url: pr.html_url,
        expected: 'human',
        agent: null,
        repo: pr.base.repo.html_url,
        user: pr.user.login,
        title: (pr.title || '').slice(0, 120),
      });
    }
  }
  humans.push(...picks);
  console.log(`${repo}: kept ${picks.length} (total ${humans.length})`);
  await sleep(300);
}

const path = join(here, 'prs-full.json');
const existing = JSON.parse(readFileSync(path, 'utf8'));
const urls = new Set(existing.map((e) => e.url));
const merged = [...existing, ...humans.filter((h) => !urls.has(h.url))];
writeFileSync(path, JSON.stringify(merged, null, 2));
console.log(`humans: ${humans.length}/${N}, merged file now ${merged.length} entries`);
if (humans.length < N) process.exitCode = 2;
