#!/usr/bin/env node
import { scanWorkingTree, scanGitHistory, scanPrDiff, dedupe } from './scan.js';
import { explainFindings } from './muse.js';

const root = process.argv[2] || '.';
const history = process.env.SENTINEL_HISTORY !== 'false';
const base = process.env.GITHUB_BASE_REF || process.env.BASE_SHA;
const head = process.env.GITHUB_HEAD_REF || process.env.HEAD_SHA;

const findings = dedupe([
  ...scanWorkingTree(root),
  ...(history ? scanGitHistory(root) : []),
  ...scanPrDiff(root, base, head),
]);

const report = {
  ok: findings.length === 0,
  count: findings.length,
  findings,
  muse: await explainFindings(findings),
};

console.log(JSON.stringify(report, null, 2));
process.exit(findings.length ? 1 : 0);
