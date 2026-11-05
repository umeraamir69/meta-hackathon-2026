#!/usr/bin/env node
/**
 * Build disposable git fixtures for RQ1 (history leak after delete).
 * Writes under paper/eval/fixtures/<case-id>/ (gitignored working copies OK;
 * rebuild anytime).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES } from './secrets.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outRoot = join(root, 'fixtures');

function git(dir, args) {
  execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
}

function writeFiles(dir, files) {
  for (const file of files) {
    const full = join(dir, file.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content);
  }
}

function buildCase(c) {
  const dir = join(outRoot, c.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const hooks = join(dir, '.empty-hooks');
  mkdirSync(hooks, { recursive: true });
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'eval@sentinel.example']);
  git(dir, ['config', 'user.name', 'Sentinel Eval']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'core.hooksPath', hooks]);

  writeFiles(dir, c.files);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', `add ${c.id}`]);

  if (c.scrub) {
    writeFiles(dir, c.scrub);
    // remove files that were scrubbed away entirely if content empty marker
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-m', `scrub ${c.id}`]);
  }

  writeFileSync(join(dir, 'CASE.json'), JSON.stringify({
    id: c.id,
    family: c.family,
    control: !!c.control,
    expect_sentinel_history: c.expect_sentinel_history,
    expect_tree_only: c.expect_tree_only,
    notes: c.notes,
  }, null, 2));
  return dir;
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const built = CASES.map((c) => {
  const dir = buildCase(c);
  process.stdout.write(`built ${c.id}\n`);
  return { id: c.id, dir };
});

writeFileSync(join(outRoot, 'index.json'), JSON.stringify({
  built_at: new Date().toISOString(),
  count: built.length,
  cases: built.map((b) => b.id),
}, null, 2));

process.stdout.write(`\n${built.length} fixtures → ${outRoot}\n`);
