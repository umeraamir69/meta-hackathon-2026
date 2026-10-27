import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mask } from '../src/rules.js';
import { redactText, scrubFindings } from '../src/redact.js';

test('configured credentials are scrubbed from findings and text', () => {
  const secret = `test-${'a'.repeat(24)}`;
  const findings = scrubFindings([
    { rule: 'generic_api_key', path: '.env', masked: mask(secret), detail: '' },
    { rule: 'aws_access_key', path: 'config.env', masked: 'AKIA••••MPLE', detail: '' },
  ], [secret]);
  assert.equal(findings[0].masked, '[redacted-configured-credential]');
  assert.equal(findings[1].masked, 'AKIA••••MPLE');
  const printed = redactText(`see ${secret} and ${mask(secret)}`, [secret]);
  assert.equal(printed.includes(secret), false);
  assert.equal(printed.includes(mask(secret)), false);
});
