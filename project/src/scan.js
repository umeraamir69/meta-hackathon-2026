import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RULES, mask } from './rules.js';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && st.size < 2_000_000) out.push(p);
  }
  return out;
}

function scanText(text, source, findings) {
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split('\n').length;
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        source,
        line,
        masked: mask(m[1] || m[0]),
      });
    }
  }
}

export function scanWorkingTree(root) {
  const findings = [];
  for (const file of walk(root)) {
    try {
      const text = readFileSync(file, 'utf8');
      scanText(text, relative(root, file), findings);
    } catch { /* binary / unreadable */ }
  }
  return findings;
}

export function scanGitHistory(root) {
  const findings = [];
  try {
    execSync('git -C "' + root + '" rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch {
    return findings; // not a git repo — skip history, working-tree scan still runs
  }
  try {
    const log = execSync('git -C "' + root + '" log -p --all --max-count=200', {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    scanText(log, 'git-history', findings);
  } catch (e) {
    findings.push({ rule: 'scan_error', severity: 'medium', source: 'git-history', line: 0, masked: String(e.message || e) });
  }
  return findings;
}

export function scanPrDiff(root, base, head) {
  const findings = [];
  if (!base || !head) return findings;
  try {
    const diff = execSync(`git -C "${root}" diff ${base}...${head}`, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    scanText(diff, 'pr-diff', findings);
  } catch (e) {
    findings.push({ rule: 'scan_error', severity: 'medium', source: 'pr-diff', line: 0, masked: String(e.message || e) });
  }
  return findings;
}

export function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const k = `${f.rule}|${f.masked}|${f.source}|${f.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
