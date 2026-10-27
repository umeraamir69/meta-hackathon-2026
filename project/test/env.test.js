import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFile } from '../src/env.js';

test('loadEnvFile fills missing names and does not override or log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-env-'));
  const file = join(dir, '.env');
  const previous = {
    MODEL_API_KEY: process.env.MODEL_API_KEY,
    META_API_KEY: process.env.META_API_KEY,
    MUSE_API_KEY: process.env.MUSE_API_KEY,
  };
  try {
    writeFileSync(file, 'export MODEL_API_KEY=from-file\nMETA_API_KEY=\n# comment\nMUSE_API_KEY=muse-file\n');
    process.env.MODEL_API_KEY = 'already-set';
    delete process.env.META_API_KEY;
    delete process.env.MUSE_API_KEY;
    loadEnvFile(file);
    assert.equal(process.env.MODEL_API_KEY, 'already-set');
    assert.equal(process.env.META_API_KEY, undefined);
    assert.equal(process.env.MUSE_API_KEY, 'muse-file');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
