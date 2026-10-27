#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from '../src/env.js';
import { explainFindings } from '../src/muse.js';

loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));

const key = process.env.MODEL_API_KEY || '';
if (!key) {
  process.stdout.write(`${JSON.stringify({ provider: 'skipped', reason: 'no key' })}\n`);
  process.exit(0);
}

const finding = {
  rule: 'aws_access_key',
  severity: 'critical',
  source: 'git-history',
  path: 'config.env',
  line: 1,
  commit: 'abc1234',
  removed: true,
  masked: 'AKIA••••MPLE',
};

const result = await explainFindings([finding]);
const blob = JSON.stringify(result);
if (blob.includes(key)) {
  process.stdout.write(`${JSON.stringify({ leaked: true, provider: result?.provider ?? null })}\n`);
  process.exit(2);
}

process.stdout.write(`${JSON.stringify({
  provider: result?.provider ?? null,
  model: result?.model ?? null,
  http_status: result?.http_status ?? null,
  note: result?.note ?? null,
  summary_chars: result?.summary?.length ?? 0,
  leaked: false,
})}\n`);
