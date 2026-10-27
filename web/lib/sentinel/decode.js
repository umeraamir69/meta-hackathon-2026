/**
 * Unwrap base64 / hex / percent-encoded layers so an encoded key is still a hit.
 * Findings from decoded text carry the encoding chain and never the raw value.
 */

const MAX_DECODE_DEPTH = 3;
const MAX_DECODED = 64000;
const MAX_TOKEN = 4096;
const MAX_CHUNKS = 50;

const RE_B64 = /[A-Za-z0-9+/]{20,}={0,2}/g;
const RE_B64URL = /[A-Za-z0-9_-]{20,}={0,2}/g;
const RE_HEX = /(?:0x)?([0-9A-Fa-f]{32,})/g;
const RE_PCT = /(?:%[0-9A-Fa-f]{2}){8,}/g;

function printable(raw) {
  if (!raw || raw.length === 0 || raw.length > MAX_DECODED) return '';
  if (raw.includes('\0')) return '';
  const text = raw.toString('utf8');
  if (text.includes('�')) return '';
  let ctrl = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 32 && code !== 10 && code !== 9 && code !== 13) ctrl += 1;
  }
  if (ctrl / (text.length + 1) > 0.05) return '';
  return text;
}

function roundTripOk(token, decoded, variant) {
  const norm = token.replace(/=+$/, '');
  const back = Buffer.from(decoded, 'utf8').toString(variant).replace(/=+$/, '');
  return back === norm;
}

export function tryBase64(token) {
  if (!token || token.length > MAX_TOKEN) return '';
  const pad = '='.repeat((4 - (token.length % 4)) % 4);
  const blob = token + pad;
  try {
    const raw = Buffer.from(blob, 'base64');
    const text = printable(raw);
    if (text && text !== token && roundTripOk(token, text, 'base64')) return text;
  } catch {
    // not strict base64
  }
  try {
    const raw = Buffer.from(blob, 'base64url');
    const text = printable(raw);
    if (text && text !== token && roundTripOk(token, text, 'base64url')) return text;
  } catch {
    // not strict base64url
  }
  return '';
}

export function tryHex(token) {
  if (!token || token.length > MAX_TOKEN) return '';
  let body = token;
  if (/^0x/i.test(body)) body = body.slice(2);
  if (body.length % 2 === 1 || !/^[0-9A-Fa-f]+$/.test(body)) return '';
  try {
    return printable(Buffer.from(body, 'hex'));
  } catch {
    return '';
  }
}

export function tryPercent(token) {
  if (!token || token.length > MAX_TOKEN) return '';
  try {
    return printable(Buffer.from(decodeURIComponent(token), 'utf8'));
  } catch {
    return '';
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function collectTokens(text, enqueue) {
  for (const [re, kind, decode] of [
    [RE_B64, 'base64', tryBase64],
    [RE_B64URL, 'base64url', tryBase64],
    [RE_HEX, 'hex', tryHex],
    [RE_PCT, 'percent', tryPercent],
  ]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      const token = kind === 'hex' ? match[1] : match[0];
      const at = kind === 'hex' ? match.index + match[0].indexOf(match[1]) : match.index;
      enqueue(token, kind, lineOf(text, at), decode);
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
  }
}

export function decodedChunks(text) {
  const body = String(text || '');
  if (!body || body.includes('\0')) return [];
  const queue = [];
  const seenTok = new Set();
  const enqueue = (token, kind, line, decode) => {
    if (!token || seenTok.has(token)) return;
    const decoded = decode(token);
    if (!decoded) return;
    seenTok.add(token);
    queue.push({ payload: decoded, chain: [kind], line });
  };
  collectTokens(body, enqueue);
  const seen = new Set();
  const out = [];
  while (queue.length && out.length < MAX_CHUNKS) {
    const item = queue.shift();
    if (seen.has(item.payload) || item.chain.length > MAX_DECODE_DEPTH) continue;
    seen.add(item.payload);
    out.push({ text: item.payload, encodings: item.chain, line: item.line });
    if (item.chain.length >= MAX_DECODE_DEPTH) continue;
    RE_B64.lastIndex = 0;
    let match;
    while ((match = RE_B64.exec(item.payload)) !== null) {
      const decoded = tryBase64(match[0]);
      if (decoded && !seen.has(decoded)) {
        queue.push({ payload: decoded, chain: [...item.chain, 'base64'], line: item.line });
      }
      if (match.index === RE_B64.lastIndex) RE_B64.lastIndex += 1;
    }
  }
  return out;
}
