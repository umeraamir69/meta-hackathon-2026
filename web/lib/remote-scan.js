import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { extract } from 'tar';
import { parseGitHubUrl } from './sentinel/github-target.js';
import { applyIgnore, loadIgnore } from './sentinel/ignore.js';
import { whereOf } from './sentinel/judge.js';
import { assessAiSignals, reviewFindings } from './sentinel/muse.js';
import { renderComment } from './sentinel/comment.js';
import { configuredSecrets, scrubFindings } from './sentinel/redact.js';
import { dedupe, markTreePresence, scanPatch, scanText, scanWorkingTree } from './sentinel/scan.js';
import { aiBranchDescriptor, aiHit, isAiAuthor, isStrictFor, scanAiMessage } from './sentinel/ai.js';

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function github(path, attempt = 1) {
  const response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders() });
  if (response.status === 404) {
    throw new Error('That repository or pull request is not public.');
  }
  // 429/5xx + abuse-limit 403s are transient: honor Retry-After, back off, retry.
  const retryAfter = Number(response.headers.get('retry-after') || 0);
  const rateLimited = response.status === 429
    || (response.status === 403 && (retryAfter > 0 || /rate limit|abuse/i.test(response.headers.get('x-ratelimit-reason') || '')));
  const flaky = response.status === 500 || response.status === 502 || response.status === 503;
  if ((rateLimited || flaky) && attempt <= 5) {
    const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** (attempt - 1), 30000);
    await sleep(wait);
    return github(path, attempt + 1);
  }
  if (response.status === 403 || response.status === 429) {
    throw new Error('GitHub rate limit reached. Add GITHUB_TOKEN on the server and try again.');
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
  const meta = {
    commit: sha,
    commitAuthor: commit.commit?.author?.name || null,
    commitDate: String(commit.commit?.author?.date || '').slice(0, 10) || null,
    commitSubject: subject,
  };
  scanText(message, { source: 'git-history', path: 'commit-message', ...meta }, findings);
  if (meta.commitAuthor && isAiAuthor(meta.commitAuthor)) {
    findings.push(aiHit('ai_author', `author: ${meta.commitAuthor}`, { source: 'git-history', path: 'commit', ...meta }, 1));
  }
  for (const file of commit.files || []) {
    if (!file.patch || !file.filename) continue;
    scanPatch(wrapPatch(file.filename, file.patch), { source: 'git-history', prefix: '', ...meta }, findings);
  }
}

function scanPullMeta(pull, findings) {
  const meta = { source: 'pr-diff', path: 'pull-request' };
  const login = pull?.user?.login || '';
  if (login && isAiAuthor(login)) {
    findings.push(aiHit('ai_author', `author: ${login}`, meta, 1));
  }
  const branch = aiBranchDescriptor(pull?.head?.ref || '');
  if (branch) findings.push(aiHit('ai_branch', branch, meta, 1));
  const text = `${pull?.title || ''}\n${pull?.body || ''}`;
  if (text.trim()) scanAiMessage(text, meta, findings);
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

  const treeFindings = [];
  const commitFindings = [];
  let scope = '';
  if (target.pull) {
    scanPullMeta(await github(`/repos/${target.owner}/${target.repo}/pulls/${target.pull}`), commitFindings);
    const files = await github(`/repos/${target.owner}/${target.repo}/pulls/${target.pull}/files?per_page=80`);
    for (const file of files) {
      if (!file.patch || !file.filename) continue;
      scanPatch(wrapPatch(file.filename, file.patch), { source: 'pr-diff', commit: null, prefix: '' }, commitFindings);
    }
    const listed = await github(`/repos/${target.owner}/${target.repo}/pulls/${target.pull}/commits?per_page=${COMMIT_LIMIT}`);
    for (const item of listed) scanCommit(await github(`/repos/${target.owner}/${target.repo}/commits/${item.sha}`), commitFindings);
    scope = `Pull request diff and ${listed.length} commit${listed.length === 1 ? '' : 's'} on that request.`;
  } else {
    const repo = await github(`/repos/${target.owner}/${target.repo}`);
    await scanArchive(target.owner, target.repo, repo.default_branch, treeFindings);
    const commits = await scanRecentCommits(target.owner, target.repo, commitFindings);
    scope = `Current files on ${repo.default_branch}, plus the ${commits} most recent commits.`;
  }

  const merged = [...treeFindings, ...commitFindings];
  const unique = dedupe(target.pull ? merged : markTreePresence(merged, treeFindings));
  for (const finding of unique) {
    if (finding.advisory && isStrictFor(process.env, finding.rule)) {
      finding.advisory = false;
      finding.severity = 'low';
    }
  }
  const blocking = unique.filter((finding) => !finding.advisory).slice(0, 40);
  const advisory = unique.filter((finding) => finding.advisory).slice(0, 10);
  const scrubbed = scrubFindings([...blocking, ...advisory], configuredSecrets());
  const muse = await reviewFindings(scrubbed);
  if (muse) {
    muse.assessment = await assessAiSignals(scrubbed);
    if (muse.assessment) muse.comment = renderComment(scrubbed, muse.labels, muse);
  }
  const labels = new Map((muse?.labels || []).map((label) => [label.where, label]));
  return {
    ok: blocking.length === 0,
    count: blocking.length,
    advisory: advisory.length,
    source: target.label,
    scope,
    findings: scrubbed.map((finding) => {
      const label = labels.get(whereOf(finding));
      return {
        severity: finding.severity,
        advisory: Boolean(finding.advisory),
        rule: finding.rule,
        source: finding.source,
        path: finding.path,
        line: finding.line,
        removed: Boolean(finding.removed),
        encoding: finding.encoding || null,
        author: finding.author || null,
        date: finding.date || null,
        presentInTree: finding.presentInTree ?? null,
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
      rotate: muse.rotate || [],
      assessment: muse.assessment || null,
    } : null,
  };
}
