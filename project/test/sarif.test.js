import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../src/scan.js';
import { toSarif } from '../src/sarif.js';

function reportFor(text) {
  const findings = scanText(text, { source: 'working-tree', path: 'app.env' }, []);
  return { ok: findings.length === 0, count: findings.length, suppressed: 0, findings, muse: null };
}

test('sarif output is versioned and masked', () => {
  const secret = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
  const doc = JSON.parse(toSarif(reportFor(`KEY=${secret}\n`)));
  assert.equal(doc.version, '2.1.0');
  assert.equal(doc.runs.length, 1);
  assert.equal(doc.runs[0].tool.driver.name, 'PR Diff Sentinel');
  assert.match(doc.runs[0].tool.driver.version, /^\d+\.\d+\.\d+/);
  const result = doc.runs[0].results[0];
  assert.equal(result.ruleId, 'aws_access_key');
  assert.equal(result.level, 'error');
  assert.equal(result.locations[0].physicalLocation.artifactLocation.uri, 'app.env');
  assert.equal(result.locations[0].physicalLocation.region.startLine, 1);
  assert.match(result.fingerprints.sha256, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(doc).includes(secret), false);
});

test('severity maps to sarif levels', () => {
  const medium = ['eyJhbGciOiJIUzI1NiJ9', 'aB3dE5fG7hJ9kL1mN3pQ', 'aB3dE5fG7hJ9kL1mN3pQ'].join('.');
  const doc = JSON.parse(toSarif(reportFor(`jwt = "${medium}"\n`)));
  assert.equal(doc.runs[0].results[0].level, 'warning');
});

test('empty reports carry no results', () => {
  const doc = JSON.parse(toSarif({ ok: true, count: 0, suppressed: 0, findings: [], muse: null }));
  assert.deepEqual(doc.runs[0].results, []);
});
