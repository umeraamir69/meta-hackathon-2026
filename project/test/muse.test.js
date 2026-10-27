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

test('local checklist carries blast radius and a purge command for history hits', async () => {
  const first = { ...finding, commit: 'aaa1111bbb222', author: 'ali', date: '2026-09-01', fingerprint: 'fp-same', presentInTree: false };
  const second = { ...finding, commit: 'bbb2222ccc333', author: 'mari', date: '2026-10-02', path: 'app/settings.py', line: 9, fingerprint: 'fp-same', presentInTree: false };
  const result = await explainFindings([first, second], { env: {} });
  assert.match(result.rotate[0].blast, /2 commits/);
  assert.match(result.rotate[0].blast, /aaa1111/);
  assert.match(result.rotate[0].blast, /mari/);
  assert.match(result.rotate[0].steps.join('\n'), /filter-repo/);
});

test('wonder why_live verdict survives into the rotate item', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      summary: 'Rotate the history key.',
      rotate: [{ rule: 'aws_access_key', where: 'git-history', why_live: 'Config file hit, still in history.', steps: ['Revoke it.'] }],
    }),
  }), { status: 200 });
  const result = await explainFindings([finding], {
    env: { MODEL_API_KEY: 'test-key-not-real' },
    fetchImpl,
  });
  assert.equal(result.rotate[0].why_live, 'Config file hit, still in history.');
});

test('prompt asks for why_live and carries the blast line', () => {
  const first = { ...finding, commit: 'aaa1111bbb222', fingerprint: 'fp-same' };
  const second = { ...finding, commit: 'bbb2222ccc333', fingerprint: 'fp-same' };
  const prompt = buildPrompt([first, second]);
  assert.match(prompt, /why_live/);
  assert.match(prompt, /2 commits/);
  assert.equal(prompt.includes(raw), false);
});

test('identical hits share one prompt block with every where listed', () => {
  const a = { ...finding, source: 'working-tree', path: 'a.env', line: 1, commit: null, removed: false };
  const b = { ...finding, source: 'working-tree', path: 'b.env', line: 1, commit: null, removed: false };
  const prompt = buildPrompt([a, b]);
  assert.match(prompt, /occurrences=2/);
  assert.match(prompt, /a\.env:1/);
  assert.match(prompt, /b\.env:1/);
  assert.equal(prompt.match(/rule=aws_access_key/g).length, 1);
});

test('wonder fix and ignore suggestions survive validation', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      summary: 'Rotate it.',
      rotate: [{
        rule: 'aws_access_key',
        where: 'working-tree:config.env:1',
        why_live: 'Config file hit.',
        fix: { path: 'config.env', before: 'KEY=AKIA••••MPLE', after: 'KEY=${AWS_ACCESS_KEY_ID}' },
        steps: ['Revoke it.'],
      }],
      ignore: [
        { pattern: 'aws_access_key docs/**', reason: 'Samples only.' },
        { pattern: '', reason: 'empty pattern is dropped' },
      ],
    }),
  }), { status: 200 });
  const live = { ...finding, source: 'working-tree', path: 'config.env', line: 1, commit: null, removed: false };
  const result = await explainFindings([live], {
    env: { MODEL_API_KEY: 'test-key-not-real' },
    fetchImpl,
  });
  assert.equal(result.rotate[0].fix.after, 'KEY=${AWS_ACCESS_KEY_ID}');
  assert.equal(result.ignore.length, 1);
  assert.equal(result.ignore[0].pattern, 'aws_access_key docs/**');
});

test('muse calls are capped with a disclosure note', async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    ...finding,
    path: `f${i}.env`,
    line: i + 1,
    context: [{ line: i + 1, text: `unique-context-${i}` }],
  }));
  let sent = '';
  const fetchImpl = async (_url, options) => {
    sent = JSON.parse(options.body).input;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({ summary: 'Many.', rotate: [] }),
    }), { status: 200 });
  };
  const result = await explainFindings(many, {
    env: { MODEL_API_KEY: 'test-key-not-real' },
    fetchImpl,
  });
  assert.match(result.note, /first 25 of 30/);
  assert.equal(sent.match(/rule=aws_access_key/g).length, 25);
});

test('local fallback suggests ignore lines only for examples', async () => {
  const sample = {
    rule: 'aws_access_key',
    severity: 'critical',
    source: 'working-tree',
    path: 'docs/aws-example.md',
    pathClass: 'docs',
    line: 4,
    removed: false,
    masked: 'AKIA••••MPLE',
    context: [{ line: 2, text: 'documentation example' }],
  };
  const live = {
    ...finding, source: 'working-tree', path: 'config.env', line: 1, commit: null,
    removed: false, pathClass: 'app', context: [{ line: 1, text: 'AWS_ACCESS_KEY_ID=AKIA••••MPLE' }],
  };
  const result = await explainFindings([sample, live], { env: {} });
  assert.equal(result.ignore.length, 1);
  assert.equal(result.ignore[0].pattern, 'aws_access_key docs/aws-example.md');
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
