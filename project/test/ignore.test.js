import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyIgnore, isIgnored, matchGlob, parseIgnore } from '../src/ignore.js';

test('globs cover nested fixtures and env files', () => {
  assert.equal(matchGlob('fixtures/**', 'fixtures/leaky-repo/config.env'), true);
  assert.equal(matchGlob('fixtures/**', 'src/cli.js'), false);
  assert.equal(matchGlob('.env', '.env'), true);
  assert.equal(matchGlob('.env.*', '.env.local'), true);
  assert.equal(matchGlob('.env.*', '.env'), false);
  assert.equal(matchGlob('project/fixtures/**', 'project/fixtures/leaky-repo/config.env'), true);
});

test('allowlist can target a path, a rule, or both', () => {
  const rules = parseIgnore(`
# comment
path fixtures/**
rule generic_api_key
aws_access_key docs/**
`);
  assert.equal(isIgnored({ rule: 'aws_access_key', path: 'fixtures/a.env' }, rules), true);
  assert.equal(isIgnored({ rule: 'generic_api_key', path: 'src/app.js' }, rules), true);
  assert.equal(isIgnored({ rule: 'aws_access_key', path: 'docs/example.txt' }, rules), true);
  assert.equal(isIgnored({ rule: 'aws_access_key', path: 'src/app.js' }, rules), false);
  assert.equal(isIgnored({ rule: 'shallow_clone', path: 'fixtures/a.env' }, rules), false);
  assert.equal(isIgnored({ rule: 'scan_error', path: 'anywhere' }, rules), false);
});

test('applyIgnore keeps the gate findings separate from suppressed ones', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-ignore-'));
  try {
    writeFileSync(join(dir, '.sentinelignore'), 'path skip.txt\n');
    const rules = parseIgnore('path skip.txt\n');
    const { kept, suppressed } = applyIgnore([
      { rule: 'aws_access_key', path: 'skip.txt' },
      { rule: 'aws_access_key', path: 'keep.txt' },
      { rule: 'scan_error', path: 'skip.txt' },
    ], rules);
    assert.equal(suppressed.length, 1);
    assert.deepEqual(kept.map((finding) => finding.path), ['keep.txt', 'skip.txt']);
    assert.equal(rules.length > 0 && dir.length > 0, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
