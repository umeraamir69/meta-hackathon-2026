import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { collectReport } from '../src/cli.js';
import { scanGitHistory, scanStaged } from '../src/scan.js';
import { awsExample, commitAll, git, removeTemp, tempRepo } from './repo.js';

const liveId = ['AKIA', 'ZZZZZZZZZZZZZZZZ'].join('');

function offlineEnv() {
  return { ...process.env, SENTINEL_MUSE: 'false' };
}

test('history findings name the author and date', () => {
  const dir = tempRepo();
  try {
    writeFileSync(join(dir, 'config.env'), `AWS_ACCESS_KEY_ID=${awsExample}\n`);
    commitAll(dir, 'add config');
    const history = scanGitHistory(dir);
    const hit = history.find((finding) => finding.rule === 'aws_access_key' && finding.source === 'git-history');
    assert.ok(hit);
    assert.equal(hit.author, 'Sentinel');
    assert.match(hit.date, /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    removeTemp(dir);
  }
});

test('deleted keys are marked absent from the tree, live ones present', async () => {
  const dir = tempRepo();
  try {
    writeFileSync(join(dir, 'live.env'), `KEY=${liveId}\n`);
    writeFileSync(join(dir, 'gone.env'), `KEY=${awsExample}\n`);
    commitAll(dir, 'add keys');
    rmSync(join(dir, 'gone.env'));
    commitAll(dir, 'delete one key');
    const report = await collectReport(dir, offlineEnv());
    assert.equal(report.ok, false);
    const deleted = report.findings.find((finding) => finding.source === 'git-history' && finding.masked.endsWith(awsExample.slice(-4)));
    assert.ok(deleted);
    assert.equal(deleted.presentInTree, false);
    const liveTree = report.findings.find((finding) => finding.source === 'working-tree' && finding.masked.endsWith(liveId.slice(-4)));
    assert.ok(liveTree);
    assert.equal(liveTree.presentInTree, true);
    const liveHistory = report.findings.find((finding) => finding.source === 'git-history' && finding.masked.endsWith(liveId.slice(-4)));
    assert.ok(liveHistory);
    assert.equal(liveHistory.presentInTree, true);
  } finally {
    removeTemp(dir);
  }
});

test('staged scan sees the index, not the working tree', () => {
  const dir = tempRepo();
  try {
    writeFileSync(join(dir, 'readme.txt'), 'hello\n');
    commitAll(dir, 'base');
    writeFileSync(join(dir, 'config.env'), `KEY=${awsExample}\n`);
    git(dir, ['add', 'config.env']);
    const staged = scanStaged(dir);
    assert.equal(staged.some((finding) => finding.rule === 'aws_access_key' && finding.source === 'staged'), true);
    git(dir, ['reset']);
    assert.equal(scanStaged(dir).length, 0);
  } finally {
    removeTemp(dir);
  }
});
