#!/usr/bin/env node
// Installs a pre-commit hook that runs the same gate as CI: working tree plus
// git history. Muse stays off in the hook so every commit is fast and offline.
// It cannot change pass or fail anyway.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'pr-diff-sentinel';
const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.js');

function usage() {
  return `Install the Sentinel pre-commit hook.

Usage:
  node scripts/install-hook.mjs [--force] [target-repo]

  target-repo defaults to the current directory.
  --force overwrites a pre-commit hook this tool did not install.
`;
}

function shQuote(value) {
  return `'${value.replaceAll(`'`, `'"'"'`)}'`;
}

function hookSource() {
  return `#!/bin/sh
# ${MARKER} pre-commit hook. Installed by project/scripts/install-hook.mjs.
# Blocks the commit when the staged diff adds secrets. Bypass one commit with:
#   git commit --no-verify
# Staged only: history findings cannot be fixed by a new commit, so the hook
# never reports them. CI still scans history.
SENTINEL_MUSE="\${SENTINEL_MUSE:-false}"
export SENTINEL_MUSE
exec node ${shQuote(cli)} --staged . > /dev/null
`;
}

function gitConfig(target, key) {
  try {
    return execFileSync('git', ['-C', target, 'config', key], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function hooksDir(target) {
  const custom = gitConfig(target, 'core.hooksPath');
  if (custom) {
    if (isAbsolute(custom)) return custom;
    const top = execFileSync('git', ['-C', target, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    return resolve(top, custom);
  }
  const gitDir = execFileSync('git', ['-C', target, 'rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim();
  return join(gitDir, 'hooks');
}

function main(argv) {
  const args = [...argv];
  let force = false;
  if (args.includes('--force')) {
    force = true;
    args.splice(args.indexOf('--force'), 1);
  }
  if (args.includes('--help') || args.includes('-h') || args.length > 1) {
    process.stdout.write(usage());
    process.exit(args.length > 1 ? 2 : 0);
  }
  const target = resolve(args[0] || '.');
  let dir;
  try {
    dir = hooksDir(target);
  } catch {
    process.stderr.write(`Not a git repository: ${target}\n`);
    process.exit(1);
  }
  mkdirSync(dir, { recursive: true });
  const hook = join(dir, 'pre-commit');
  if (existsSync(hook)) {
    const current = readFileSync(hook, 'utf8');
    if (current.includes(MARKER)) {
      process.stdout.write(`Hook already installed: ${hook}\n`);
      process.exit(0);
    }
    if (!force) {
      process.stderr.write(
        `A pre-commit hook already exists: ${hook}\nRe-run with --force to replace it, or add this line to it:\n  node ${cli} --staged . > /dev/null\n`,
      );
      process.exit(1);
    }
  }
  writeFileSync(hook, hookSource(), 'utf8');
  chmodSync(hook, 0o755);
  process.stdout.write(`Installed the Sentinel pre-commit hook: ${hook}\n`);
}

main(process.argv.slice(2));
