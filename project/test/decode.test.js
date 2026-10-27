import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../src/scan.js';
import { decodedChunks, tryBase64, tryHex, tryPercent } from '../src/decode.js';

const ALNUM = 'aB3dE5fG7hJ9kL1mN3pQ5rStUvWxYz2468';

function tok(n) {
  let out = '';
  while (out.length < n) out += ALNUM;
  return out.slice(0, n);
}

function pct(raw) {
  return String(raw).split('').map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
}

test('decoders reject noise', () => {
  assert.equal(tryBase64('not-base64!!'), '');
  assert.equal(tryBase64('short'), '');
  assert.equal(tryHex('zz'), '');
  assert.equal(tryHex('abc'), '');
  assert.equal(tryPercent('%zz%zz%zz%zz'), '');
  assert.equal(decodedChunks('nothing encoded here').length, 0);
  assert.equal(decodedChunks('').length, 0);
});

test('base64 layer still fails the gate', () => {
  const secret = ['ghp_', tok(36)].join('');
  const blob = Buffer.from(secret, 'utf8').toString('base64');
  const found = scanText(`TOKEN_B64=${blob}\n`, { source: 'working-tree', path: 'app.env' }, []);
  const hit = found.find((finding) => finding.rule === 'github_pat');
  assert.ok(hit);
  assert.match(hit.encoding, /base64/);
  assert.equal(JSON.stringify(found).includes(secret), false);
});

test('hex layer still fails the gate', () => {
  const secret = ['xoxb-', tok(20)].join('');
  const blob = Buffer.from(secret, 'utf8').toString('hex');
  const found = scanText(`TOKEN_HEX=${blob}\n`, { source: 'working-tree', path: 'app.env' }, []);
  const hit = found.find((finding) => finding.rule === 'slack_token');
  assert.ok(hit);
  assert.match(hit.encoding, /hex/);
  assert.equal(JSON.stringify(found).includes(secret), false);
});

test('percent layer still fails the gate', () => {
  const secret = tok(24);
  const blob = pct(`api_key=${secret}`);
  const found = scanText(`PAIR=${blob}\n`, { source: 'working-tree', path: 'app.env' }, []);
  const hit = found.find((finding) => finding.rule === 'generic_api_key');
  assert.ok(hit);
  assert.match(hit.encoding, /percent/);
  assert.equal(JSON.stringify(found).includes(secret), false);
});

test('double encoding is unwrapped with provenance', () => {
  const secret = ['sk_live_', tok(26)].join('');
  const once = Buffer.from(secret, 'utf8').toString('base64');
  const twice = Buffer.from(once, 'utf8').toString('base64');
  const found = scanText(`TOKEN_B64=${twice}\n`, { source: 'working-tree', path: 'app.env' }, []);
  const hit = found.find((finding) => finding.rule === 'stripe_live');
  assert.ok(hit);
  assert.match(hit.encoding, /\+/);
});

test('long tokens that decode to nothing are ignored', () => {
  const found = scanText('NOTE=deadbeefcafebabe0123456789abcdef\n', { source: 'working-tree', path: 'app.env' }, []);
  assert.equal(found.length, 0);
});
