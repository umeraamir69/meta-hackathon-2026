import { RULES, mask } from './rules.js';

const DOCS = /(^|\/)(docs?|examples?)(\/|$)|(^|\/)readme(\.[^/]+)?$|example\.(md|txt|rst)$/i;
const TESTS = /(^|\/)(tests?|__tests__|spec)(\/|$|\.)|\.(test|spec)\.[^/]+$/i;
const FIXTURES = /(^|\/)(fixtures?|__fixtures__|testdata)(\/|$)/i;

export function pathClass(path) {
  const value = String(path || '').replaceAll('\\', '/');
  if (value === 'commit-message') return 'commit-message';
  if (FIXTURES.test(value)) return 'fixture';
  if (TESTS.test(value)) return 'test';
  if (DOCS.test(value)) return 'docs';
  return 'app';
}

export function redactLine(text) {
  let out = String(text ?? '');
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    out = out.replace(re, (match, group) => mask(typeof group === 'string' ? group : match));
  }
  return out;
}

export function neighborhood(text, raw, masked, line, radius = 2) {
  if (!raw || String(raw).includes('\n') || String(raw).includes('PRIVATE KEY')) {
    return [{ line: line || 1, text: String(masked || '').slice(0, 180) }];
  }
  const lines = String(text ?? '').split('\n');
  const index = Math.min(Math.max(Number(line) || 1, 1), Math.max(lines.length, 1)) - 1;
  const from = Math.max(0, index - radius);
  const to = Math.min(lines.length, index + radius + 1);
  return lines.slice(from, to).map((row, offset) => ({
    line: from + offset + 1,
    text: redactLine(row.split(raw).join(masked)).slice(0, 180),
  }));
}
