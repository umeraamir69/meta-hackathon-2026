import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const awsExample = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');

function git(dir, args) {
  execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
}

/** HEAD keeps a documentation example. Git history still contains the config key that was deleted. */
export function writeDemoRepo(dir) {
  mkdirSync(dir, { recursive: true });
  const hooks = join(dir, '.empty-hooks');
  mkdirSync(hooks, { recursive: true });
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'sentinel@example.com']);
  git(dir, ['config', 'user.name', 'Sentinel']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'core.hooksPath', hooks]);
  writeFileSync(join(dir, 'config.env'), `AWS_ACCESS_KEY_ID=${awsExample}\n`);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'add deploy config']);
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'aws-example.md'), [
    'This page is documentation.',
    'The value below is an example, not a live credential.',
    '',
    `AWS_ACCESS_KEY_ID=${awsExample}`,
    '',
  ].join('\n'));
  writeFileSync(join(dir, 'config.env'), '# removed\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'delete the key and keep the docs example']);
  return dir;
}
