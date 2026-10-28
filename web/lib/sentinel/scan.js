import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { neighborhood, pathClass, redactLine } from './context.js';
import { decodedChunks } from './decode.js';
import { RULES, acceptHit, compositeHits, mask, shannonEntropy } from './rules.js';
import { aiHit, isAiAuthor, isAiPath, scanAiContent, scanAiMessage } from './ai.js';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.vercel', 'out']);

function toPosix(path) {
  return path.split(sep).join('/');
}

function walk(dir, out = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    let st;
    try {
      st = lstatSync(path);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(path, out);
    else if (st.isFile() && st.size < 2_000_000) out.push(path);
  }
  return out;
}

export function fingerprintOf(raw) {
  return createHash('sha256').update(String(raw || ''), 'utf8').digest('hex');
}

function pushHit(findings, rule, raw, meta, line, extra = {}) {
  const masked = mask(raw);
  const path = meta.path ?? meta.source;
  findings.push({
    rule: rule.id,
    severity: rule.severity,
    source: meta.source,
    path,
    line,
    commit: meta.commit || null,
    author: meta.commitAuthor || null,
    date: meta.commitDate || null,
    removed: Boolean(meta.removed),
    encoding: extra.encoding || meta.encoding || null,
    masked,
    fingerprint: fingerprintOf(raw),
    entropy: Math.round(shannonEntropy(raw) * 100) / 100,
    pathClass: pathClass(path),
    context: extra.context || neighborhood(extra.text ?? '', raw, masked, line),
    commitSubject: meta.commitSubject ? redactLine(meta.commitSubject).slice(0, 160) : null,
    presentInTree: null,
  });
  return findings;
}

export function scanText(text, meta, findings) {
  if (!text || text.includes('\0')) return findings;
  const body = String(text);
  const multiline = body.includes('\n');
  const lines = multiline ? body.split('\n') : null;
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(body)) !== null) {
      const line = meta.line ?? body.slice(0, match.index).split('\n').length;
      const raw = match[1] || match[0];
      const index = (meta.line == null && lines ? line - 1 : 0);
      if (acceptHit(rule.id, raw, meta.line == null ? lines : null, index)) {
        pushHit(findings, rule, raw, meta, line, { text: body });
      }
      if (match.index === rule.re.lastIndex) rule.re.lastIndex += 1;
    }
  }
  scanAiContent(body, meta, findings);
  if (meta.path === 'commit-message') scanAiMessage(body, meta, findings);
  if (!meta.decoded) {
    for (const chunk of decodedChunks(body)) {
      const before = findings.length;
      scanText(chunk.text, { ...meta, line: undefined, decoded: true, encoding: chunk.encodings.join('+') }, findings);
      const sourceLine = meta.line ?? chunk.line;
      for (let i = before; i < findings.length; i += 1) findings[i].line = sourceLine;
    }
    if (meta.line == null) {
      for (const hit of compositeHits(body)) {
        pushHit(findings, { id: hit.rule, severity: hit.severity }, hit.raw, meta, hit.line, { text: body });
      }
    }
  }
  return findings;
}

function git(root, args, maxBuffer = 32 * 1024 * 1024) {
  return execFileSync('git', ['-C', root, '-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    maxBuffer,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitOk(root, args) {
  try {
    return git(root, args).trim();
  } catch {
    return null;
  }
}

function repoLayout(root) {
  let here;
  try {
    here = realpathSync(root);
  } catch {
    return null;
  }
  const topRaw = gitOk(here, ['rev-parse', '--show-toplevel']);
  if (!topRaw) return null;
  let top;
  try {
    top = realpathSync(topRaw);
  } catch {
    return null;
  }
  const prefix = toPosix(relative(top, here));
  if (prefix.startsWith('..')) return null;
  return { here, top, prefix };
}

function stripPrefix(file, prefix) {
  if (!file) return prefix ? null : 'unknown';
  const path = file.replaceAll('\\', '/');
  if (!prefix) return path;
  if (path === prefix) return path.slice(path.lastIndexOf('/') + 1);
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length + 1);
  return null;
}

export function scanPatch(patch, meta, findings) {
  let file = null;
  let newLine = 0;
  let oldLine = 0;
  let binary = false;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      binary = false;
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      file = match ? match[2] : null;
      const seen = stripPrefix(file, meta.prefix);
      if (seen && isAiPath(seen)) {
        findings.push(aiHit('ai_artifact', `tracked file: ${seen}`, { ...meta, path: seen }, 1));
      }
      continue;
    }
    if (line.startsWith('GIT binary patch') || line.startsWith('Binary files ')) {
      binary = true;
      continue;
    }
    if (binary) continue;
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('index ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('similarity ') ||
      line.startsWith('rename ') ||
      line.startsWith('old mode') ||
      line.startsWith('new mode')
    ) {
      continue;
    }
    const visible = stripPrefix(file, meta.prefix);
    if (line.startsWith('+')) {
      if (visible !== null) scanText(line.slice(1), { ...meta, path: visible, line: newLine }, findings);
      newLine += 1;
      continue;
    }
    if (line.startsWith('-')) {
      if (visible !== null) scanText(line.slice(1), { ...meta, path: visible, line: oldLine, removed: true }, findings);
      oldLine += 1;
      continue;
    }
    if (line.startsWith(' ')) {
      newLine += 1;
      oldLine += 1;
    }
  }
  return findings;
}

function errorFinding(source) {
  return {
    rule: 'scan_error',
    severity: 'medium',
    source,
    path: source,
    line: 0,
    commit: null,
    removed: false,
    masked: 'git command failed',
    detail: 'The git command failed. This run is not a clean result.',
  };
}

export function scanWorkingTree(root) {
  const findings = [];
  for (const file of walk(root)) {
    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      continue;
    }
    if (buf.includes(0)) continue;
    const rel = toPosix(relative(root, file));
    if (isAiPath(rel)) {
      findings.push(aiHit('ai_artifact', `tracked file: ${rel}`, { source: 'working-tree', path: rel }, 1));
    }
    scanText(buf.toString('utf8'), { source: 'working-tree', path: rel }, findings);
  }
  return findings;
}

function commitLimit(maxCommits) {
  const n = Number(maxCommits);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) return 200;
  return Math.floor(n);
}

export function scanGitHistory(root, { maxCommits = 200 } = {}) {
  const findings = [];
  const layout = repoLayout(root);
  if (!layout) return findings;
  const { here, prefix } = layout;
  if (!prefix && gitOk(here, ['rev-parse', '--is-shallow-repository']) === 'true') {
    findings.push({
      rule: 'shallow_clone',
      severity: 'high',
      source: 'git-history',
      path: '.git',
      line: 0,
      commit: null,
      removed: false,
      masked: 'history truncated',
      detail: 'Checkout with fetch-depth: 0 so secrets deleted from HEAD stay visible.',
    });
  }
  let log;
  try {
    const args = ['log', '-p', '--all', `-n${commitLimit(maxCommits)}`, '--format=format:SENTINEL_COMMIT %H%nSENTINEL_AUTHOR %an%nSENTINEL_DATE %as%n%B%nSENTINEL_ENDMSG'];
    if (prefix) args.push('--', '.');
    log = git(here, args);
  } catch (error) {
    const message = String(error.stderr || error.message || '');
    if (/does not have any commits/.test(message)) return findings;
    findings.push(errorFinding('git-history'));
    return findings;
  }
  const chunks = log.split(/^SENTINEL_COMMIT /m).filter((chunk) => chunk.trim());
  for (const chunk of chunks) {
    const header = chunk.split('\n');
    const sha = (header[0] || '').trim();
    const commitAuthor = (header[1] || '').startsWith('SENTINEL_AUTHOR ')
      ? header[1].slice('SENTINEL_AUTHOR '.length).trim().slice(0, 120) || null
      : null;
    const commitDate = (header[2] || '').startsWith('SENTINEL_DATE ')
      ? header[2].slice('SENTINEL_DATE '.length).trim().slice(0, 32) || null
      : null;
    const rest = header.slice(3).join('\n');
    const end = rest.indexOf('SENTINEL_ENDMSG');
    const message = end === -1 ? '' : rest.slice(0, end);
    const patch = end === -1 ? rest : rest.slice(end + 'SENTINEL_ENDMSG'.length);
    const commitSubject = redactLine(message.split('\n')[0] || '').slice(0, 160);
    const meta = { commit: sha, commitAuthor, commitDate, commitSubject };
    if (commitAuthor && isAiAuthor(commitAuthor)) {
      findings.push(aiHit('ai_author', `author: ${commitAuthor}`, { source: 'git-history', path: 'commit', ...meta }, 0));
    }
    if (!prefix) scanText(message, { source: 'git-history', path: 'commit-message', ...meta }, findings);
    scanPatch(patch, { source: 'git-history', prefix, ...meta }, findings);
  }
  return findings;
}

export function scanStaged(root) {
  const findings = [];
  const layout = repoLayout(root);
  if (!layout) return findings;
  const { here, prefix } = layout;
  try {
    const args = ['diff', '--cached', '--no-ext-diff', '--no-textconv'];
    if (prefix) args.push('--', '.');
    const diff = git(here, args, 16 * 1024 * 1024);
    scanPatch(diff, { source: 'staged', prefix }, findings);
  } catch {
    findings.push(errorFinding('staged'));
  }
  return findings;
}

function safeRev(rev) {
  if (!rev || rev.startsWith('-') || !/^[A-Za-z0-9._/-]{1,200}$/.test(rev)) return null;
  return rev;
}

export function scanPrDiff(root, base, head) {
  const findings = [];
  const baseRev = safeRev(base);
  const headRev = safeRev(head);
  if (!baseRev || !headRev) return findings;
  const layout = repoLayout(root);
  if (!layout) return findings;
  const { here, prefix } = layout;
  try {
    const args = ['diff', `${baseRev}...${headRev}`];
    if (prefix) args.push('--', '.');
    const diff = git(here, args, 16 * 1024 * 1024);
    scanPatch(diff, { source: 'pr-diff', commit: headRev, prefix }, findings);
  } catch {
    findings.push(errorFinding('pr-diff'));
  }
  return findings;
}

export function dedupe(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = [finding.rule, finding.masked, finding.source, finding.path, finding.line, finding.commit, finding.removed, finding.encoding].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Mark whether each non-tree finding also appears in the current files.
 * A history hit with presentInTree=false is the incident this tool sells:
 * deleted from the files, still recoverable from git.
 */
export function markTreePresence(findings, treeFindings) {
  const inTree = new Set((treeFindings || []).map((finding) => `${finding.rule}|${finding.masked}`));
  for (const finding of findings) {
    if (!finding || !finding.fingerprint || finding.advisory) continue;
    if (finding.source === 'working-tree' || finding.source === 'staged') {
      finding.presentInTree = true;
    } else {
      finding.presentInTree = inTree.has(`${finding.rule}|${finding.masked}`);
    }
  }
  return findings;
}
