#!/usr/bin/env node
// Vendors the scanner core from project/src into web/lib/sentinel so this
// app deploys to Vercel with Root Directory `web` (a `../project` import
// cannot resolve there). Re-run after changing the scanner core.
// `--check` exits 1 when the vendored copy drifted (used by CI).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = [
  'ai.js',
  'rules.js',
  'decode.js',
  'rotate.js',
  'scan.js',
  'context.js',
  'ignore.js',
  'judge.js',
  'muse.js',
  'comment.js',
  'github-target.js',
  'redact.js',
];

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'project', 'src');
const dest = join(here, '..', 'lib', 'sentinel');
const check = process.argv.includes('--check');

mkdirSync(dest, { recursive: true });

const drifted = [];
for (const file of FILES) {
  const wanted = readFileSync(join(src, file));
  let current = null;
  try {
    current = readFileSync(join(dest, file));
  } catch {
    current = null;
  }
  if (current && wanted.equals(current)) continue;
  if (check) {
    drifted.push(file);
  } else {
    copyFileSync(join(src, file), join(dest, file));
  }
}

if (!check) {
  for (const name of readdirSync(dest)) {
    if (name.endsWith('.js') && !FILES.includes(name)) rmSync(join(dest, name));
  }
}

if (drifted.length) {
  process.stderr.write(`Sentinel core drifted: ${drifted.join(', ')}. Run: node scripts/sync-sentinel.mjs\n`);
  process.exit(1);
}
process.stdout.write(check ? 'Sentinel core in sync.\n' : `Vendored ${FILES.length} files into web/lib/sentinel.\n`);
