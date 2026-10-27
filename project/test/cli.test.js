import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotationText } from '../src/annotate.js';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');

function baseEnv() {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME || '',
    SENTINEL_MUSE: 'false',
    SENTINEL_HISTORY: 'false',
  };
}

function credential() {
  const envPath = join(project, '.env');
  if (!existsSync(envPath)) return '';
  return readFileSync(envPath, 'utf8').match(/^MODEL_API_KEY=(.+)$/m)?.[1]?.trim() || '';
}

function assertNoCredential(text) {
  const secret = credential();
  assert.ok(!secret || !text.includes(secret), 'command output contained credential material');
}

function runCli(args) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    cwd: project,
    encoding: 'utf8',
    env: baseEnv(),
  });
}

test('leaky fixture fails the gate', () => {
  const result = runCli(['fixtures/leaky-repo']);
  assertNoCredential(result.stdout + result.stderr);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((finding) => finding.rule === 'aws_access_key'));
  assert.equal(report.muse.provider, 'local-fallback');
  assert.ok(report.muse.labels.some((label) => label.label === 'likely_example'));
  assert.match(report.muse.comment, /FAIL/);
});

test('clean fixture passes', () => {
  const result = runCli(['fixtures/clean-repo']);
  assertNoCredential(result.stdout + result.stderr);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.count, 0);
  assert.equal(report.muse, null);
});

test('github annotations include the file and line', () => {
  const previous = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = 'true';
  try {
    const text = annotationText([{
      rule: 'aws_access_key',
      severity: 'critical',
      path: 'config.env',
      line: 1,
      source: 'working-tree',
      masked: 'AKIA••••MPLE',
    }]);
    assert.match(text, /::error file=config\.env,line=1/);
  } finally {
    if (previous === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = previous;
  }
});
