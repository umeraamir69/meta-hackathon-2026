import { whereOf } from './judge.js';

function cell(value) {
  return String(value ?? '').replaceAll('|', '/').replaceAll('\n', ' ').trim().slice(0, 220);
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const LABEL_RANK = { likely_live: 0, unclear: 1, likely_fixture: 2, likely_example: 3 };

/** Deterministic fix order: live first, then unclear, then fixtures and examples. */
export function triageOrder(findings, labels) {
  const byWhere = new Map((labels || []).map((label) => [label?.where, label?.label]));
  return [...(findings || [])]
    .map((finding) => ({
      where: whereOf(finding),
      labelRank: LABEL_RANK[byWhere.get(whereOf(finding))] ?? 1,
      severityRank: SEVERITY_RANK[finding?.severity] ?? 2,
      historyFirst: finding?.removed || finding?.source === 'git-history' ? 0 : 1,
    }))
    .sort((a, b) => (
      a.labelRank - b.labelRank
      || a.severityRank - b.severityRank
      || a.historyFirst - b.historyFirst
      || (a.where < b.where ? -1 : a.where > b.where ? 1 : 0)
    ))
    .map((item) => item.where);
}

export function renderComment(findings, labels, explanation) {
  const byWhere = new Map((labels || []).map((label) => [label.where, label]));
  const blocking = (findings || []).filter((finding) => !finding.advisory);
  const advisory = (findings || []).filter((finding) => finding.advisory);
  const gate = blocking.length ? 'FAIL' : 'PASS';
  const rows = blocking.map((finding) => {
    const label = byWhere.get(whereOf(finding));
    return `| ${cell(finding.severity)} | ${cell(finding.rule)} | ${cell(whereOf(finding))} | ${cell(label?.label || 'unclear')} | ${cell(label?.why || '')} |`;
  });
  const aiRows = advisory.map((finding) => (
    `| ${cell(finding.rule)} | ${cell(whereOf(finding))} | ${cell(finding.masked)} |`
  ));
  const triage = triageOrder(blocking, labels);
  const rotate = (explanation?.rotate || []).flatMap((item) => {
    const lines = [`- ${cell(item.where)}`];
    if (item.why_live) lines.push(`  Why live: ${cell(item.why_live)}`);
    if (item.blast) lines.push(`  Blast radius: ${cell(item.blast)}`);
    for (const step of item.steps || []) lines.push(`  - ${cell(step)}`);
    if (item.fix) {
      lines.push(`  Fix \`${cell(item.fix.path)}\`:`, '  ```diff', `  - ${cell(item.fix.before)}`, `  + ${cell(item.fix.after)}`, '  ```');
    }
    return lines;
  });
  const ignore = (explanation?.ignore || []).map((item) => `- \`${cell(item.pattern)}\` — ${cell(item.reason)}`);
  const summary = cell(explanation?.summary || '');
  const model = [explanation?.classifier?.model, explanation?.model].filter(Boolean).join(', ') || 'local checklist';
  return [
    '**PR Diff Sentinel: ' + gate + '**',
    '',
    'The merge gate is a deterministic secret scan of the pull request diff and git history. Muse does not decide pass or fail.',
    '',
    '| Severity | Rule | Where | Label | Why |',
    '| --- | --- | --- | --- | --- |',
    ...(rows.length ? rows : ['|  |  |  |  | No findings. |']),
    '',
    '### Triage',
    '',
    ...(triage.length ? triage.map((where, index) => `${index + 1}. ${cell(where)}`) : ['- Nothing to fix.']),
    '',
    '### Muse',
    '',
    `${cell(explanation?.provider || 'local-fallback')} (${cell(model)})`,
    '',
    summary,
    '',
    '### Rotate',
    '',
    ...(rotate.length ? rotate : ['- No rotation steps.']),
    '',
    '### Suggested .sentinelignore',
    '',
    ...(ignore.length ? ignore : ['- None. Every hit looks live or unclear.']),
    '',
    ...(advisory.length ? [
      '### AI signals (advisory, never blocks)',
      '',
      'Self-declared signs of agent authorship. Signals, not proof.',
      '',
      '| Signal | Where | Detail |',
      '| --- | --- | --- |',
      ...aiRows,
      '',
    ] : []),
  ].join('\n').slice(0, 12000);
}
