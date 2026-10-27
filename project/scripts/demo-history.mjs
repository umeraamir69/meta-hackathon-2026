#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDemoRepo } from '../src/demo-repo.js';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = writeDemoRepo(mkdtempSync(join(tmpdir(), 'sentinel-demo-')));

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

try {
  const result = spawnSync(process.execPath, [join(project, 'src/cli.js'), dir], {
    cwd: project,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME || '',
      SENTINEL_MUSE: 'false',
    },
  });
  const envPath = join(project, '.env');
  const secret = existsSync(envPath)
    ? (readFileSync(envPath, 'utf8').match(/^MODEL_API_KEY=(.+)$/m)?.[1]?.trim() || '')
    : '';
  const blob = `${result.stdout}${result.stderr}`;
  if (secret && blob.includes(secret)) fail('scanner output contained credential material');
  if (result.status !== 1) fail(`expected scanner exit 1, got ${result.status}`);
  const report = JSON.parse(result.stdout);
  const live = report.muse.labels.filter((label) => label.label === 'likely_live');
  const example = report.muse.labels.filter((label) => label.label === 'likely_example');
  const removed = report.findings.filter((finding) => finding.removed && finding.rule === 'aws_access_key');
  if (!removed.length) fail('expected a deleted history key');
  if (!live.length) fail('expected a likely_live label');
  if (!example.length) fail('expected a likely_example label');
  if (report.ok) fail('the gate must stay failed when Muse calls something an example');
  const aws = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
  if (JSON.stringify(report).includes(aws)) fail('report contained the raw example key');
  process.stdout.write('history gate: FAIL\n');
  process.stdout.write(`likely_live: ${live.length}\n`);
  process.stdout.write(`likely_example: ${example.length}\n`);
  process.stdout.write(`muse: ${report.muse.provider}\n`);
} catch (error) {
  process.stderr.write(`demo failed: ${error.message || 'git or scan error'}\n`);
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
