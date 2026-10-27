import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const template = join(projectRoot, '.tmp', 'git-template');

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
  const root = join(projectRoot, '.tmp');
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'repo-'));
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
