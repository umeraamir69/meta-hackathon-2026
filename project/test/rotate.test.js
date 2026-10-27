import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { FALLBACK_HINT, rotateHint } from '../src/rotate.js';

test('known providers name the rotation page', () => {
  assert.match(rotateHint('aws_access_key'), /IAM/);
  assert.match(rotateHint('github_pat'), /settings\/tokens/);
  assert.match(rotateHint('stripe_live'), /live payments/);
  assert.match(rotateHint('slack_webhook'), /Incoming Webhooks/);
  assert.match(rotateHint('db_url'), /database password/);
});

test('unknown rules fall back without inventing a page', () => {
  assert.equal(rotateHint('no_such_rule'), FALLBACK_HINT);
  assert.equal(rotateHint(''), FALLBACK_HINT);
});

test('every gate rule has a dedicated hint', () => {
  const ids = new Set(RULES.map((rule) => rule.id));
  ids.add('gcp_service_key');
  for (const id of ids) {
    assert.notEqual(rotateHint(id), FALLBACK_HINT, id);
  }
});
