/**
 * Deterministic AI-attribution matchers. Advisory only: these findings never
 * fail the gate unless SENTINEL_AI_STRICT=true promotes them. Signals, not
 * proof — a PR without signals is not certified human. See AI_SIGNALS.md.
 */
import { createHash } from 'node:crypto';
import { neighborhood, pathClass, redactLine } from './context.js';
import { matchGlob } from './ignore.js';

const ASSISTANTS = 'claude|codex|copilot|chatgpt|openai|anthropic|gemini|cursor|aider|devin';
const ASSISTANT_WORD = new RegExp(`\\b(?:${ASSISTANTS})\\b`, 'i');
const BOT_NAME = /(?:\[bot\]|bot\b)/i;

// Assistant-name forms only, so this matcher cannot match its own source.
// Trailers stay in message mode: in file content the colon form matches
// code and docs that merely mention trailers next to assistant names.
const BANNER = new RegExp(`generated\\s+(?:with|by)\\s+(?:an?\\s+)?(?:${ASSISTANTS})\\b`, 'gi');

const TRAILER = /^\s*(co-authored-by|generated-by|assisted-by|co-created-by)\s*:\s*(.+?)\s*$/gim;
const MESSAGE_PHRASE = new RegExp(
  `ai-generated|generated\\s+with\\s+.{0,40}(?:ai\\b|${ASSISTANTS})|written\\s+by\\s+(?:an?\\s+)?(?:ai\\b|${ASSISTANTS})|created\\s+with\\s+ai\\s+assistance`,
  'i',
);
const BRANCH = new RegExp(`(?:^|/)(?:copilot|codex|claude|devin|cursor|swe-agent)/`, 'i');

const ARTIFACTS = [
  'AGENTS.md',
  'CLAUDE.md',
  '**/AGENTS.md',
  '**/CLAUDE.md',
  '.claude/**',
  '**/.claude/**',
  '.codex/**',
  '**/.codex/**',
  '.cursor/**',
  '**/.cursor/**',
  '.copilot/**',
  '**/.copilot/**',
  '.ai/**',
  '**/.ai/**',
  '.aider*',
  '**/.aider*',
  '.muserules',
  '**/.muserules',
  '.cursorrules',
  '**/.cursorrules',
  'ai-instructions*',
  '**/ai-instructions*',
];

export function isAiAuthor(name) {
  const text = String(name || '');
  if (!text) return false;
  return BOT_NAME.test(text) || ASSISTANT_WORD.test(text);
}

export function isAiPath(path) {
  const value = String(path || '').replaceAll('\\', '/');
  if (!value) return false;
  return ARTIFACTS.some((pattern) => matchGlob(pattern, value));
}

export function aiBranchDescriptor(ref) {
  const text = String(ref || '').trim();
  if (!text || text.length > 200) return null;
  return BRANCH.test(text) ? `branch: ${text.slice(0, 120)}` : null;
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function aiContentHits(text) {
  const out = [];
  for (const [index, line] of String(text || '').split('\n').entries()) {
    BANNER.lastIndex = 0;
    let match;
    while ((match = BANNER.exec(line)) !== null) {
      out.push({
        rule: 'ai_banner',
        descriptor: match[0].trim().slice(0, 120),
        line: index + 1,
        context: redactLine(line).slice(0, 180),
      });
      if (match.index === BANNER.lastIndex) BANNER.lastIndex += 1;
    }
  }
  return uniqueBy(out, (hit) => `${hit.descriptor}|${hit.line}`);
}

export function aiMessageHits(message) {
  const out = [];
  const body = String(message || '');
  TRAILER.lastIndex = 0;
  let match;
  while ((match = TRAILER.exec(body)) !== null) {
    const value = (match[2] || '').trim();
    if (value && (ASSISTANT_WORD.test(value) || BOT_NAME.test(value))) {
      out.push({
        rule: 'ai_trailer',
        descriptor: `trailer: ${match[1]}: ${value}`.slice(0, 160),
        line: body.slice(0, match.index).split('\n').length,
      });
    }
    if (match.index === TRAILER.lastIndex) TRAILER.lastIndex += 1;
  }
  for (const [index, line] of body.split('\n').entries()) {
    if (MESSAGE_PHRASE.test(line)) {
      out.push({ rule: 'ai_trailer', descriptor: `message: ${line.trim()}`.slice(0, 160), line: index + 1 });
    }
  }
  return uniqueBy(out, (hit) => hit.descriptor);
}

export function aiHit(rule, descriptor, meta, line, contextText = '') {
  const desc = String(descriptor || 'ai signal').slice(0, 160);
  const path = meta.path ?? meta.source;
  return {
    rule,
    severity: 'info',
    advisory: true,
    source: meta.source,
    path,
    line: line || 1,
    commit: meta.commit || null,
    author: meta.commitAuthor || null,
    date: meta.commitDate || null,
    removed: Boolean(meta.removed),
    encoding: null,
    masked: desc,
    fingerprint: createHash('sha256').update(`${rule}:${desc}`, 'utf8').digest('hex'),
    entropy: null,
    pathClass: pathClass(path),
    context: neighborhood(contextText || desc, '', desc, line || 1),
    commitSubject: meta.commitSubject ? redactLine(meta.commitSubject).slice(0, 160) : null,
    presentInTree: null,
  };
}

export function scanAiContent(text, meta, findings) {
  if (!text || String(text).includes('\0')) return findings;
  for (const hit of aiContentHits(String(text))) {
    findings.push(aiHit(hit.rule, hit.descriptor, meta, meta.line ?? hit.line, hit.context));
  }
  return findings;
}

export function scanAiMessage(message, meta, findings) {
  if (!message) return findings;
  for (const hit of aiMessageHits(String(message))) {
    findings.push(aiHit(hit.rule, hit.descriptor, meta, hit.line));
  }
  return findings;
}
