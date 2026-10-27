import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const template = join(tmpdir(), 'sentinel-git-template');

export const awsExample = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');

export function git(dir, args) {
  mkdirSync(template, { recursive: true });
  execFileSync('git', ['-C', dir, ...args], {
    stdio: 'pipe',
    env: { ...process.env, GIT_TEMPLATE_DIR: template },
  });
}

export function initRepo(dir) {
  mkdirSync(dir, { recursive: true });
  const hooks = join(dir, '.empty-hooks');
  mkdirSync(hooks, { recursive: true });
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'sentinel@example.com']);
  git(dir, ['config', 'user.name', 'Sentinel']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'core.hooksPath', hooks]);
}

export function tempRepo() {
  // OS temp, not project/.tmp: test files run in parallel and the self-scan
  // test walks the project tree, so scratch repos must live outside it.
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-repo-'));
  initRepo(dir);
  return dir;
}

export function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', message]);
}

export function removeTemp(dir) {
  rmSync(dir, { recursive: true, force: true });
}
