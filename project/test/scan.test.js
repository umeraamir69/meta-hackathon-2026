import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanWorkingTree, dedupe } from '../src/scan.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'leaky-repo');

test('flags AKIA key in working tree', () => {
  const hits = dedupe(scanWorkingTree(root));
  assert.ok(hits.some((h) => h.rule === 'aws_access_key'));
});
