import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertPullRequestComment } from '../src/github-comment.js';

test('an existing sentinel comment is updated instead of duplicated', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body });
    if (!options.method) {
      return new Response(JSON.stringify([
        { id: 9, body: '<!-- pr-diff-sentinel -->\nold' },
      ]), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };
  const result = await upsertPullRequestComment({
    token: 'token',
    repo: 'umeraamir69/meta-hackathon-2026',
    pr: '12',
    body: '**PR Diff Sentinel: FAIL**',
    fetchImpl,
  });
  assert.equal(result.posted, true);
  assert.equal(result.updated, true);
  assert.equal(calls[1].method, 'PATCH');
  assert.match(calls[1].url, /issues\/comments\/9$/);
  assert.match(calls[1].body, /pr-diff-sentinel/);
});
