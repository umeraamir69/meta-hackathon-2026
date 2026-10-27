import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mask } from '../src/rules.js';
import { buildPrompt, explainFindings } from '../src/muse.js';

const raw = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
const finding = {
  rule: 'aws_access_key',
  severity: 'critical',
  source: 'git-history',
  path: 'config.env',
  line: 1,
  commit: 'abc123def456',
  removed: true,
  masked: mask(raw),
};

test('prompt contains the mask and not the raw secret', () => {
  const prompt = buildPrompt([finding]);
  assert.equal(prompt.includes(raw), false);
  assert.match(prompt, /already failed/);
  assert.match(prompt, /AKIA/);
});

test('no key uses the local checklist', async () => {
  let called = false;
  const result = await explainFindings([finding], {
    env: {},
    fetchImpl: async () => {
      called = true;
      throw new Error('should not be called');
    },
  });
  assert.equal(called, false);
  assert.equal(result.provider, 'local-fallback');
  assert.match(result.note, /MODEL_API_KEY/);
  assert.ok(result.rotate[0].steps.length >= 2);
});

test('muse request carries masked findings only', async () => {
  let seen = '';
  const fetchImpl = async (_url, options) => {
    seen = options.body;
    assert.equal(options.headers.Authorization, 'Bearer test-key-not-real');
    return new Response(JSON.stringify({
      output: [{
        type: 'message',
        content: [{
          type: 'output_text',
          text: '{"summary":"Rotate the exposed AWS key.","rotate":[{"rule":"aws_access_key","where":"git-history","steps":["Revoke it.","Store the new value in CI."]}]}',
        }],
      }],
      usage: { input_tokens: 12, output_tokens: 8 },
    }), { status: 200 });
  };
  const result = await explainFindings([finding], {
    env: { MODEL_API_KEY: 'test-key-not-real' },
    fetchImpl,
  });
  assert.equal(seen.includes(raw), false);
  assert.equal(seen.includes('test-key-not-real'), false);
  assert.equal(result.provider, 'muse-wonder');
  assert.equal(result.model, 'muse-wonder-1.0');
  assert.equal(result.http_status, 200);
  assert.match(result.summary, /Rotate/);
  assert.equal(result.usage.input_tokens, 12);
});

test('HTTP failures stay on the local checklist and hide the body', async () => {
  const fetchImpl = async () => new Response('super-secret-body', { status: 401 });
  const result = await explainFindings([finding], {
    env: { MODEL_API_KEY: 'test-key-not-real' },
    fetchImpl,
  });
  const blob = JSON.stringify(result);
  assert.equal(result.provider, 'local-fallback');
  assert.equal(result.http_status, 401);
  assert.match(result.note, /HTTP 401/);
  assert.equal(blob.includes('super-secret-body'), false);
  assert.equal(blob.includes('test-key-not-real'), false);
});

test('contributor models are refused before any request', async () => {
  let called = false;
  const result = await explainFindings([finding], {
    env: { MODEL_API_KEY: 'test-key-not-real', SENTINEL_MODEL: 'muse-spark-1.3-contributor' },
    fetchImpl: async () => {
      called = true;
      throw new Error('should not be called');
    },
  });
  assert.equal(called, false);
  assert.match(result.note, /contributor/);
});

test('a response that echoes the key is discarded', async () => {
  const key = 'test-key-not-real';
  const fetchImpl = async () => new Response(JSON.stringify({
    output_text: `leaked ${key}`,
  }), { status: 200 });
  const result = await explainFindings([finding], {
    env: { MODEL_API_KEY: key },
    fetchImpl,
  });
  assert.equal(result.provider, 'local-fallback');
  assert.equal(JSON.stringify(result).includes(key), false);
});
