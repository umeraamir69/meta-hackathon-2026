import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { whereOf } from './judge.js';

/** SARIF 2.1.0 for GitHub code scanning. Masked values only, never raw secrets. */

function toolVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));
    return String(pkg.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

function sarifLevel(severity) {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    default:
      return 'note';
  }
}

export function toSarif(report, options = {}) {
  const findings = Array.isArray(report) ? report : (report?.findings || []);
  const labels = new Map(((Array.isArray(report) ? [] : (report?.muse?.labels || []))).map((label) => [label.where, label]));
  const seenRule = new Set();
  const rules = [];
  const results = [];
  for (const finding of findings) {
    if (!finding || !finding.rule) continue;
    if (!seenRule.has(finding.rule)) {
      seenRule.add(finding.rule);
      rules.push({
        id: finding.rule,
        shortDescription: { text: `Possible leaked ${finding.rule}` },
      });
    }
    const label = labels.get(whereOf(finding));
    results.push({
      ruleId: finding.rule,
      level: sarifLevel(finding.severity),
      message: { text: `${finding.rule} at ${finding.path} (masked: ${finding.masked || 'n/a'})` },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: String(finding.path || 'unknown') },
          region: { startLine: Number(finding.line) || 1 },
        },
      }],
      fingerprints: { 'sha256': String(finding.fingerprint || `${finding.rule}:${finding.path}:${finding.line}`) },
      properties: {
        masked: finding.masked || null,
        severity: finding.severity || null,
        source: finding.source || null,
        commit: finding.commit || null,
        author: finding.author || null,
        date: finding.date || null,
        removed: Boolean(finding.removed),
        encoding: finding.encoding || null,
        presentInTree: finding.presentInTree ?? null,
        label: label?.label || null,
        why: label?.why || null,
      },
    });
  }
  return JSON.stringify({
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'PR Diff Sentinel',
          version: options.version || toolVersion(),
          informationUri: options.informationUri || 'https://github.com/umeraamir69/meta-hackathon-2026',
          rules,
        },
      },
      results,
    }],
  }, null, 2);
}
