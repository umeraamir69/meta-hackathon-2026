import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanWorkingTree } from '../src/scan.js';
import { triageOrder } from '../src/comment.js';
import { reviewFindings, buildClassifyPrompt } from '../src/muse.js';
import { renderReport } from '../src/report-html.js';
import { awsExample } from './repo.js';

test('context sent forward does not contain the raw key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-ctx-'));
  try {
    writeFileSync(join(dir, 'config.env'), `AWS_ACCESS_KEY_ID=${awsExample}\n`);
    const hit = scanWorkingTree(dir).find((finding) => finding.rule === 'aws_access_key');
    assert.equal(JSON.stringify(hit.context).includes(awsExample), false);
    assert.equal(hit.pathClass, 'app');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an example label does not clear the gate', async () => {
  const finding = {
    rule: 'aws_access_key',
    severity: 'critical',
    source: 'working-tree',
    path: 'docs/aws-example.md',
    pathClass: 'docs',
    line: 4,
    removed: false,
    masked: 'AKIA••••MPLE',
    context: [{ line: 2, text: 'The value below is an example, not a live credential.' }],
  };
  const review = await reviewFindings([finding], { env: { SENTINEL_MUSE: 'false' } });
  assert.equal(review.labels[0].label, 'likely_example');
  assert.equal(review.provider, 'local-fallback');
  assert.match(review.comment, /FAIL/);
  assert.equal(review.comment.includes(awsExample), false);
});

test('Spark labels and Wonder explains only the live hit', async () => {
  const live = {
    rule: 'aws_access_key',
    severity: 'critical',
    source: 'git-history',
    path: 'config.env',
    pathClass: 'app',
    line: 1,
    removed: true,
    commit: 'abc123def456',
    masked: 'AKIA••••MPLE',
    context: [{ line: 1, text: 'AWS_ACCESS_KEY_ID=AKIA••••MPLE' }],
  };
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
  const models = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    models.push(body.model);
    assert.equal(options.body.includes(awsExample), false);
    if (body.model === 'muse-spark-1.3') {
      const prompt = JSON.parse(options.body).input;
      assert.match(prompt, /likely_live/);
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          labels: [
            { where: 'git-history:abc123d:config.env:1 (removed)', label: 'likely_live', why: 'Still in history.' },
            { where: 'working-tree:docs/aws-example.md:4', label: 'likely_example', why: 'Docs sample.' },
          ],
        }),
        usage: { input_tokens: 4, output_tokens: 3 },
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        summary: 'Rotate the history key.',
        rotate: [{ rule: 'aws_access_key', where: 'git-history:abc123d:config.env:1 (removed)', steps: ['Revoke it.'] }],
      }),
      usage: { input_tokens: 5, output_tokens: 2 },
    }), { status: 200 });
  };
  const review = await reviewFindings([live, sample], {
    env: { MODEL_API_KEY: 'test-key-not-real' },
    fetchImpl,
  });
  assert.deepEqual(models, ['muse-spark-1.3', 'muse-wonder-1.0']);
  assert.equal(review.labels[0].label, 'likely_live');
  assert.equal(review.labels[0].why, 'Still in history.');
  assert.equal(review.labels[0].provider, 'muse-spark');
  assert.equal(review.labels[1].label, 'likely_example');
  assert.equal(review.provider, 'muse-wonder');
  assert.equal(review.usage.input_tokens, 9);
  assert.match(review.summary, /Rotate the history key/);
  const classifyPrompt = buildClassifyPrompt([live, sample]);
  assert.equal(classifyPrompt.includes(awsExample), false);
});

test('triage order puts live history hits before examples', () => {
  const live = { rule: 'aws_access_key', severity: 'critical', source: 'git-history', path: 'config.env', line: 1, removed: true, commit: 'abc123def456' };
  const sample = { rule: 'aws_access_key', severity: 'critical', source: 'working-tree', path: 'docs/aws-example.md', line: 4, removed: false };
  const order = triageOrder([sample, live], [
    { where: 'working-tree:docs/aws-example.md:4', label: 'likely_example' },
    { where: 'git-history:abc123d:config.env:1 (removed)', label: 'likely_live' },
  ]);
  assert.deepEqual(order, ['git-history:abc123d:config.env:1 (removed)', 'working-tree:docs/aws-example.md:4']);
});

test('pr comment carries triage, fix, and ignore sections', async () => {
  const live = {
    rule: 'aws_access_key',
    severity: 'critical',
    source: 'working-tree',
    path: 'app/settings.py',
    pathClass: 'app',
    line: 3,
    removed: false,
    masked: 'AKIA••••MPLE',
    context: [{ line: 3, text: 'KEY=AKIA••••MPLE' }],
  };
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.model === 'muse-spark-1.3') {
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          labels: [{ where: 'working-tree:app/settings.py:3', label: 'likely_live', why: 'App config.' }],
        }),
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        summary: 'Rotate the app key.',
        rotate: [{
          rule: 'aws_access_key',
          where: 'working-tree:app/settings.py:3',
          why_live: 'Live config value.',
          fix: { path: 'app/settings.py', before: 'KEY=AKIA••••MPLE', after: 'KEY=os.environ["APP_KEY"]' },
          steps: ['Revoke it.'],
        }],
        ignore: [],
      }),
    }), { status: 200 });
  };
  const review = await reviewFindings([live], {
    env: { MODEL_API_KEY: 'test-key-not-real' },
    fetchImpl,
  });
  assert.match(review.comment, /### Triage/);
  assert.match(review.comment, /1\. working-tree:app\/settings\.py:3/);
  assert.match(review.comment, /```diff/);
  assert.match(review.comment, /os\.environ/);
  assert.match(review.comment, /Suggested \.sentinelignore/);
});

test('report page escapes markup', () => {
  const html = renderReport({
    ok: false,
    count: 1,
    suppressed: 0,
    findings: [{
      severity: 'critical',
      rule: 'aws_access_key',
      source: 'working-tree',
      path: '<script>',
      line: 1,
      masked: 'AKIA••••MPLE',
      context: [],
    }],
    muse: {
      provider: 'local-fallback',
      summary: '<img>',
      labels: [{ where: 'working-tree:<script>:1', rule: 'aws_access_key', label: 'likely_live', why: '<b>' }],
      rotate: [],
    },
  });
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Fail/);
});
