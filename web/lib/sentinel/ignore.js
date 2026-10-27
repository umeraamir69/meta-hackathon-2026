import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function escapeRegExp(value) {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

export function matchGlob(glob, path) {
  const g = String(glob).replaceAll('\\', '/');
  const p = String(path).replaceAll('\\', '/');
  const body = g.split('**').map((part) => part.split('*').map(escapeRegExp).join('[^/]*')).join('.*');
  return new RegExp(`^${body}$`).test(p);
}

export function parseIgnore(text) {
  const rules = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('path ')) {
      rules.push({ kind: 'path', glob: line.slice(5).trim() });
      continue;
    }
    if (line.startsWith('rule ')) {
      rules.push({ kind: 'rule', rule: line.slice(5).trim() });
      continue;
    }
    const space = line.indexOf(' ');
    if (space === -1) continue;
    rules.push({ kind: 'pair', rule: line.slice(0, space).trim(), glob: line.slice(space + 1).trim() });
  }
  return rules;
}

export function loadIgnore(root) {
  const file = join(root, '.sentinelignore');
  if (!existsSync(file)) return [];
  return parseIgnore(readFileSync(file, 'utf8'));
}

export function isIgnored(finding, rules) {
  if (!finding || finding.rule === 'scan_error' || finding.rule === 'shallow_clone') return false;
  const path = finding.path || '';
  return rules.some((rule) => {
    if (rule.kind === 'path') return matchGlob(rule.glob, path);
    if (rule.kind === 'rule') return finding.rule === rule.rule;
    if (rule.kind === 'pair') return finding.rule === rule.rule && matchGlob(rule.glob, path);
    return false;
  });
}

export function applyIgnore(findings, rules) {
  const kept = [];
  const suppressed = [];
  for (const finding of findings) {
    if (isIgnored(finding, rules)) suppressed.push(finding);
    else kept.push(finding);
  }
  return { kept, suppressed };
}
