import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseGitHubUrl } from './sentinel/github-target.js';
import { applyIgnore, loadIgnore } from './sentinel/ignore.js';
import { whereOf } from './sentinel/judge.js';
import { assessAiSignals, reviewFindings } from './sentinel/muse.js';
import { renderComment } from './sentinel/comment.js';
import { configuredSecrets, scrubFindings } from './sentinel/redact.js';
import { dedupe, markTreePresence, scanPatch, scanText, scanWorkingTree } from './sentinel/scan.js';
import { aiBranchDescriptor, aiHit, isAiAuthor, isStrictFor, scanAiMessage } from './sentinel/ai.js';

const ARCHIVE_LIMIT = 50_000_000;
const COMMIT_LIMIT = 8;

/**
 * Minimal tar reader (ustar/pax), zero dependencies. The npm `tar` package
 * breaks Vercel's post-build collector, and the serverless runtime has no
 * `tar` binary — so we parse the 512-byte blocks ourselves. Handles regular
 * files and directories; pax extended headers override the following entry's
 * name. Anything else (links, devices, absolute paths, `..`) is skipped.
 */
function readCString(block, offset, length) {
  const end = block.indexOf(0, offset);
  const stop = end === -1 || end > offset + length ? offset + length : end;
  return block.toString('utf8', offset, stop);
}

async function extractTarBuffer(buffer, cwd) {
  const root = resolve(cwd);
  let offset = 0;
  let paxName = null;
  const take = (entry, size) => {
    const start = offset;
    offset += Math.ceil(size / 512) * 512;
    return entry ? buffer.subarray(start, start + size) : null;
  };
  while (offset + 512 <= buffer.length) {
    const block = buffer.subarray(offset, offset + 512);
    if (block.every((byte) => byte === 0)) break; // end-of-archive padding
    offset += 512;
    const type = String.fromCharCode(block[156]);
    const size = Number.parseInt(readCString(block, 124, 12).trim() || '0', 8);
    if (!Number.isFinite(size) || size < 0 || offset + size > buffer.length) break;
    if (type === 'x' || type === 'g') {
      const text = (take(true, size) || Buffer.alloc(0)).toString('utf8');
      const match = text.match(/(\d+) path=([^\n]*)\n/);
      if (match && type === 'x') paxName = match[2];
      continue;
    }
    if (type === 'L') { // GNU long name: data block is the next entry's name
      paxName = (take(true, size) || Buffer.alloc(0)).toString('utf8').replace(/\0[\s\S]*$/, '');
      continue;
    }
    const rawName = paxName || join(readCString(block, 345, 155), readCString(block, 0, 100));
    paxName = null;
    const isFile = type === '0' || type === '\0';
    const data = take(isFile || type === '5', size);
    if (data === null) continue;
    const dest = resolve(root, rawName);
    if (dest !== root && !dest.startsWith(root + sep)) continue; // traversal guard
    if (type === '5') {
      await mkdir(dest, { recursive: true });
      continue;
    }
    if (!isFile) continue;
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, data);
  }
}

function tooLargeError(mb) {
  const cap = Math.round(ARCHIVE_LIMIT / 1_000_000);
  const size = mb ? ` (about ${mb} MB)` : '';
  return new Error(
    `That repository is too large for the hosted scan${size} — files over ${cap} MB are skipped. ` +
      'Paste a pull request link instead: PR scans read only the diff and its commits.',
  );
}

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

export async function github(path, attempt = 1) {
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
    if (size > ARCHIVE_LIMIT) {
      await reader.cancel();
      throw tooLargeError();
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function scanArchive(owner, repo, branch, findings) {
  const response = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/${encodeURIComponent(branch)}`, {
    headers: { 'User-Agent': 'pr-diff-sentinel' },
  });
  if (!response.ok) throw new Error('Could not download that public repository.');
  const advertised = Number(response.headers.get('content-length') || 0);
  if (advertised > ARCHIVE_LIMIT) {
    await response.body?.cancel();
    throw tooLargeError(Math.round(advertised / 1_000_000));
  }
  const dir = await mkdtemp(join(tmpdir(), 'sentinel-web-'));
  try {
    await extractTarBuffer(gunzipSync(await readCapped(response)), dir);
    const names = await readdir(dir);
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
  if (!target) throw new Error('Use a public https://github.com/owner/repo link, a pull request link, or a commit link.');

  const treeFindings = [];
  const commitFindings = [];
  let scope = '';
  let treeScanned = false;
  if (target.commit) {
    const commit = await github(`/repos/${target.owner}/${target.repo}/commits/${target.commit}`);
    scanCommit(commit, commitFindings);
    const when = String(commit.commit?.author?.date || '').slice(0, 10) || 'unknown date';
    scope = `Single commit ${(commit.sha || target.commit).slice(0, 7)} by ${commit.commit?.author?.name || 'unknown'} on ${when}.`;
  } else if (target.pull) {
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
    const treeMb = Math.round(((repo.size || 0) * 1024) / 1_000_000);
    if (treeMb <= 400) {
      try {
        await scanArchive(target.owner, target.repo, repo.default_branch, treeFindings);
        treeScanned = true;
      } catch (error) {
        if (!/too large/.test(error.message || '')) throw error;
      }
    }
    const commits = await scanRecentCommits(target.owner, target.repo, commitFindings);
    scope = treeScanned
      ? `Current files on ${repo.default_branch}, plus the ${commits} most recent commits.`
      : `This repository is over 50 MB, so current files were skipped. Scanned the ${commits} most recent commits. Open a pull request link to scan that diff.`;
  }

  const merged = [...treeFindings, ...commitFindings];
  const unique = dedupe(target.pull || !treeScanned ? merged : markTreePresence(merged, treeFindings));
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
