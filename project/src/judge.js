const EXAMPLE = /\b(example|dummy|fake|placeholder|sample|documentation|not a live)\b/i;

export function localJudgement(finding) {
  const where = whereOf(finding);
  if (!finding || finding.rule === 'scan_error' || finding.rule === 'shallow_clone') {
    return {
      rule: finding?.rule || '',
      where,
      label: 'unclear',
      why: 'The scanner could not read a normal secret hit.',
    };
  }
  const around = (finding.context || []).map((row) => row.text).join('\n');
  if (EXAMPLE.test(around) || finding.pathClass === 'docs') {
    return {
      rule: finding.rule,
      where,
      label: 'likely_example',
      why: 'The surrounding text or path looks like documentation or a sample. The gate still fails.',
    };
  }
  if (finding.pathClass === 'fixture' || finding.pathClass === 'test') {
    return {
      rule: finding.rule,
      where,
      label: 'likely_fixture',
      why: 'The path looks like a test or fixture. The gate still fails.',
    };
  }
  if (finding.path === 'commit-message' || finding.removed || finding.source === 'git-history') {
    return {
      rule: finding.rule,
      where,
      label: 'likely_live',
      why: 'The value is in git history. Deleting it from the latest file does not remove it from old commits.',
    };
  }
  return {
    rule: finding.rule,
    where,
    label: 'likely_live',
    why: 'The path looks like application code or config.',
  };
}

export function whereOf(finding) {
  const commit = finding?.commit ? `${String(finding.commit).slice(0, 7)}:` : '';
  const removed = finding?.removed ? ' (removed)' : '';
  return `${finding?.source || 'scan'}:${commit}${finding?.path || 'unknown'}:${finding?.line || 0}${removed}`;
}
