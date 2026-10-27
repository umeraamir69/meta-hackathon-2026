import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { awsExample, commitAll, git, removeTemp, tempRepo } from './repo.js';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const installer = join(project, 'scripts', 'install-hook.mjs');

function install(target, args = []) {
  return spawnSync(process.execPath, [installer, ...args, target], {
    encoding: 'utf8',
    env: { ...process.env, SENTINEL_MUSE: 'false' },
  });
}

function useDefaultHooks(dir) {
  git(dir, ['config', '--unset', 'core.hooksPath']);
}

test('installs an executable pre-commit hook', () => {
  const dir = tempRepo();
  try {
    useDefaultHooks(dir);
    const result = install(dir);
    assert.equal(result.status, 0, result.stderr);
    const hook = join(dir, '.git', 'hooks', 'pre-commit');
    assert.equal(existsSync(hook), true);
    assert.match(readFileSync(hook, 'utf8'), /pr-diff-sentinel/);
    assert.notEqual(statSync(hook).mode & 0o111, 0);
  } finally {
    removeTemp(dir);
  }
});

test('a commit that adds a secret is blocked, a clean one lands', () => {
  const dir = tempRepo();
  try {
    useDefaultHooks(dir);
    assert.equal(install(dir).status, 0);
    writeFileSync(join(dir, 'config.env'), `AWS_KEY=${awsExample}\n`, 'utf8');
    assert.throws(() => commitAll(dir, 'add config'));
    assert.throws(() => git(dir, ['rev-parse', 'HEAD']));
    writeFileSync(join(dir, 'config.env'), 'AWS_KEY=change-me\n', 'utf8');
    commitAll(dir, 'add config');
    git(dir, ['rev-parse', 'HEAD']);
  } finally {
    removeTemp(dir);
  }
});

test('a foreign hook is kept without --force and replaced with it', () => {
  const dir = tempRepo();
  try {
    useDefaultHooks(dir);
    const hook = join(dir, '.git', 'hooks', 'pre-commit');
    mkdirSync(dirname(hook), { recursive: true });
    writeFileSync(hook, '#!/bin/sh\nexit 0\n', 'utf8');
    const refused = install(dir);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /--force/);
    assert.doesNotMatch(readFileSync(hook, 'utf8'), /pr-diff-sentinel/);
    const forced = install(dir, ['--force']);
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(readFileSync(hook, 'utf8'), /pr-diff-sentinel/);
  } finally {
    removeTemp(dir);
  }
});

test('a custom core.hooksPath is honoured', () => {
  const dir = tempRepo();
  try {
    assert.equal(install(dir).status, 0);
    assert.equal(existsSync(join(dir, '.empty-hooks', 'pre-commit')), true);
  } finally {
    removeTemp(dir);
  }
});
