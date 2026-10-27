import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dedupe, scanGitHistory, scanPrDiff, scanWorkingTree } from '../src/scan.js';
import { applyIgnore, loadIgnore } from '../src/ignore.js';
import { awsExample, commitAll, git, removeTemp, tempRepo } from './repo.js';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const leaky = join(project, 'fixtures', 'leaky-repo');

test('flags the planted key in the working tree and masks it', () => {
  const hits = dedupe(scanWorkingTree(leaky));
  const hit = hits.find((finding) => finding.rule === 'aws_access_key');
  assert.ok(hit);
  assert.equal(hit.path, 'config.env');
  assert.equal(hit.masked.includes(awsExample), false);
  assert.equal(hit.masked.startsWith(awsExample.slice(0, 4)), true);
  assert.equal(hit.masked.endsWith(awsExample.slice(-4)), true);
});

test('clean fixture has no findings', () => {
  const hits = scanWorkingTree(join(project, 'fixtures', 'clean-repo'));
  assert.equal(hits.length, 0);
});

test('does not treat a binary file as text', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-bin-'));
  try {
    writeFileSync(join(dir, 'blob.bin'), Buffer.from([0, 65, 75, 73, 65]));
    assert.equal(scanWorkingTree(dir).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('history keeps a secret that was deleted from HEAD', () => {
  const dir = tempRepo();
  try {
    writeFileSync(join(dir, 'config.env'), `AWS_ACCESS_KEY_ID=${awsExample}\n`);
    commitAll(dir, 'add config');
    rmSync(join(dir, 'config.env'));
    commitAll(dir, 'delete config');
    const tree = scanWorkingTree(dir);
    const history = dedupe(scanGitHistory(dir));
    assert.equal(tree.some((finding) => finding.rule === 'aws_access_key'), false);
    const hit = history.find((finding) => finding.rule === 'aws_access_key' && finding.removed);
    assert.ok(hit);
    assert.equal(hit.path, 'config.env');
    assert.equal(hit.source, 'git-history');
    assert.equal(typeof hit.commit, 'string');
    assert.equal(hit.masked.includes(awsExample), false);
  } finally {
    removeTemp(dir);
  }
});

test('history scan of a subdirectory ignores a sibling secret', () => {
  const dir = tempRepo();
  try {
    mkdirSync(join(dir, 'app'));
    mkdirSync(join(dir, 'other'));
    writeFileSync(join(dir, 'app', 'readme.txt'), 'clean\n');
    writeFileSync(join(dir, 'other', 'config.env'), `AWS_ACCESS_KEY_ID=${awsExample}\n`);
    commitAll(dir, 'seed');
    const hits = scanGitHistory(join(dir, 'app'));
    assert.equal(hits.some((finding) => finding.rule === 'aws_access_key'), false);
  } finally {
    removeTemp(dir);
  }
});

test('commit message secrets are findings', () => {
  const dir = tempRepo();
  try {
    writeFileSync(join(dir, 'readme.txt'), 'hello\n');
    git(dir, ['add', 'readme.txt']);
    git(dir, ['commit', '-m', `rotate ${awsExample}`]);
    const hit = scanGitHistory(dir).find((finding) => finding.path === 'commit-message');
    assert.ok(hit);
    assert.equal(hit.rule, 'aws_access_key');
    assert.equal(hit.masked.includes(awsExample), false);
  } finally {
    removeTemp(dir);
  }
});

test('pull request diff flags a secret introduced on the branch', () => {
  const dir = tempRepo();
  try {
    writeFileSync(join(dir, 'readme.txt'), 'hello\n');
    commitAll(dir, 'base');
    const base = execSha(dir, 'main');
    git(dir, ['checkout', '-b', 'feature']);
    writeFileSync(join(dir, 'config.env'), `TOKEN=${awsExample}\n`);
    commitAll(dir, 'feature');
    const head = execSha(dir, 'HEAD');
    const hits = scanPrDiff(dir, base, head);
    assert.ok(hits.some((finding) => finding.rule === 'aws_access_key' && finding.source === 'pr-diff'));
    assert.equal(scanPrDiff(dir, 'not a rev', head).length, 0);
  } finally {
    removeTemp(dir);
  }
});

test('names such as MODEL_API_KEY are part of the gate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-generic-'));
  try {
    // Built in two parts so this test file itself never contains the pattern.
    const value = ['K7mQ2vX9pL4rT6wY8', 'zA3dE5fG6'].join('');
    writeFileSync(join(dir, 'app.env'), `MODEL_API_KEY=${value}\n`);
    const hit = scanWorkingTree(dir).find((finding) => finding.rule === 'generic_api_key');
    assert.ok(hit);
    assert.equal(hit.line, 1);
    assert.equal(hit.masked.includes(value), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a low-entropy labeled value is not a finding', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-entropy-'));
  try {
    writeFileSync(join(dir, 'app.env'), `MODEL_API_KEY=${'k'.repeat(24)}\n`);
    const hits = scanWorkingTree(dir);
    assert.equal(hits.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tool working tree is clean after the allowlist', () => {
  const { kept, suppressed } = applyIgnore(dedupe(scanWorkingTree(project)), loadIgnore(project));
  assert.deepEqual(kept.map((finding) => `${finding.rule}:${finding.path}`), []);
  const envPath = join(project, '.env');
  if (!existsSync(envPath)) return;
  const secret = readFileSync(envPath, 'utf8').match(/^MODEL_API_KEY=(.+)$/m)?.[1]?.trim();
  assert.ok(suppressed.some((finding) => finding.path === '.env'));
  assert.ok(!secret || !JSON.stringify(kept).includes(secret), 'working-tree report contained credential material');
  assert.ok(!secret || !JSON.stringify(suppressed).includes(secret), 'suppressed report contained credential material');
});

function execSha(dir, rev) {
  return execFileSync('git', ['-C', dir, 'rev-parse', rev], { encoding: 'utf8' }).trim();
}
