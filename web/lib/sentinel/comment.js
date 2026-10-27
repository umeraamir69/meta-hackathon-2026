import { whereOf } from './judge.js';

function cell(value) {
  return String(value ?? '').replaceAll('|', '/').replaceAll('\n', ' ').trim().slice(0, 220);
}

export function renderComment(findings, labels, explanation) {
  const byWhere = new Map((labels || []).map((label) => [label.where, label]));
  const gate = findings?.length ? 'FAIL' : 'PASS';
  const rows = (findings || []).map((finding) => {
    const label = byWhere.get(whereOf(finding));
    return `| ${cell(finding.severity)} | ${cell(finding.rule)} | ${cell(whereOf(finding))} | ${cell(label?.label || 'unclear')} | ${cell(label?.why || '')} |`;
  });
  const rotate = (explanation?.rotate || []).flatMap((item) => (
    (item.steps || []).map((step) => `- ${cell(item.where)}: ${cell(step)}`)
  ));
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
  ].join('\n').slice(0, 12000);
}
