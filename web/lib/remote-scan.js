import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { extract } from 'tar';
import { parseGitHubUrl } from '../../project/src/github-target.js';
import { applyIgnore, loadIgnore } from '../../project/src/ignore.js';
import { whereOf } from '../../project/src/judge.js';
import { reviewFindings } from '../../project/src/muse.js';
import { dedupe, scanPatch, scanText, scanWorkingTree } from '../../project/src/scan.js';

const ARCHIVE_LIMIT = 25_000_000;
const COMMIT_LIMIT = 8;

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pr-diff-sentinel',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders() });
  if (response.status === 403 || response.status === 429) {
    throw new Error('GitHub rate limit reached. Add GITHUB_TOKEN on the server and try again.');
  }
  if (response.status === 404) {
    throw new Error('That repository or pull request is not public.');
  }
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  return response.json();
}

function wrapPatch(filename, patch) {
  const safe = String(filename || 'unknown').replaceAll(' ', '_');
  return `diff --git a/${safe} b/${safe}\n${patch}`;
}

function scanCommit(commit, findings) {
  const sha = commit.sha;
  const message = commit.commit?.message || '';
  const subject = message.split('\n')[0] || '';
  scanText(message, { source: 'git-history', path: 'commit-message', commit: sha, commitSubject: subject }, findings);
  for (const file of commit.files || []) {
    if (!file.patch || !file.filename) continue;
    scanPatch(wrapPatch(file.filename, file.patch), { source: 'git-history', commit: sha, prefix: '', commitSubject: subject }, findings);
  }
}

async function readCapped(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > ARCHIVE_LIMIT) throw new Error('That repository is too large for the hosted scan.');
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function scanArchive(owner, repo, branch, findings) {
  const response = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/${encodeURIComponent(branch)}`, {
    headers: { 'User-Agent': 'pr-diff-sentinel' },
  });
  if (!response.ok) throw new Error('Could not download that public repository.');
  const dir = await mkdtemp(join(tmpdir(), 'sentinel-web-'));
  try {
    const tarPath = join(dir, 'repo.tar');
    await writeFile(tarPath, gunzipSync(await readCapped(response)));
    await extract({ file: tarPath, cwd: dir });
    const names = (await readdir(dir)).filter((name) => name !== 'repo.tar');
    const root = join(dir, names[0] || '');
    const raw = scanWorkingTree(root);
    const { kept } = applyIgnore(raw, loadIgnore(root));
    findings.push(...kept);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function scanRecentCommits(owner, repo, findings) {
  const list = await github(`/repos/${owner}/${repo}/commits?per_page=${COMMIT_LIMIT}`);
  for (const item of list) {
    scanCommit(await github(`/repos/${owner}/${repo}/commits/${item.sha}`), findings);
  }
  return list.length;
}

export async function scanRemote(input) {
  const target = parseGitHubUrl(input);
  if (!target) throw new Error('Use a public https://github.com/owner/repo link, or a pull request link.');

  const findings = [];
  let scope = '';
  if (target.pull) {
    const files = await github(`/repos/${target.owner}/${target.repo}/pulls/${target.pull}/files?per_page=80`);
    for (const file of files) {
      if (!file.patch || !file.filename) continue;
      scanPatch(wrapPatch(file.filename, file.patch), { source: 'pr-diff', commit: null, prefix: '' }, findings);
    }
    const listed = await github(`/repos/${target.owner}/${target.repo}/pulls/${target.pull}/commits?per_page=${COMMIT_LIMIT}`);
    for (const item of listed) scanCommit(await github(`/repos/${target.owner}/${target.repo}/commits/${item.sha}`), findings);
    scope = `Pull request diff and ${listed.length} commit${listed.length === 1 ? '' : 's'} on that request.`;
  } else {
    const repo = await github(`/repos/${target.owner}/${target.repo}`);
    await scanArchive(target.owner, target.repo, repo.default_branch, findings);
    const commits = await scanRecentCommits(target.owner, target.repo, findings);
    scope = `Current files on ${repo.default_branch}, plus the ${commits} most recent commits.`;
  }

  const unique = dedupe(findings).slice(0, 40);
  const muse = await reviewFindings(unique);
  const labels = new Map((muse?.labels || []).map((label) => [label.where, label]));
  return {
    ok: unique.length === 0,
    count: unique.length,
    source: target.label,
    scope,
    findings: unique.map((finding) => {
      const label = labels.get(whereOf(finding));
      return {
        severity: finding.severity,
        rule: finding.rule,
        source: finding.source,
        path: finding.path,
        line: finding.line,
        removed: Boolean(finding.removed),
        masked: finding.masked,
        label: label?.label || null,
        why: label?.why || '',
      };
    }),
    muse: muse ? {
      provider: muse.provider,
      model: muse.model,
      summary: muse.summary,
      classifier: muse.classifier || null,
    } : null,
  };
}
