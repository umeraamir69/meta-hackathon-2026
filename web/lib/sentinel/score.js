/** Deterministic risk score from findings. Muse explains; score never flips Pass/Fail. */

const SEV = { critical: 18, high: 12, medium: 7, low: 3 };

export function scoreReport(report) {
  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const blocking = findings.filter((f) => !f.advisory);
  const advisory = findings.filter((f) => f.advisory);
  const live = blocking.filter((f) => f.label === 'likely_live').length;
  const examples = blocking.filter((f) => f.label === 'likely_example' || f.label === 'likely_fixture').length;
  const deleted = blocking.filter((f) => f.presentInTree === false).length;

  let value = 0;
  const factors = [];

  if (!blocking.length && !advisory.length) {
    return {
      value: 0,
      grade: 'A',
      label: 'Clean',
      headline: 'No secrets and no AI advisories in this scan.',
      factors: [{ key: 'clean', text: 'Gate is clear', weight: 0 }],
      live: 0,
      examples: 0,
      deleted: 0,
      blocking: 0,
      advisory: 0,
    };
  }

  if (!blocking.length && advisory.length) {
    value = Math.min(28, 8 + advisory.length * 4);
    factors.push({ key: 'advisory', text: `${advisory.length} AI advisory signal${advisory.length === 1 ? '' : 's'} (never block)`, weight: value });
    return {
      value,
      grade: value >= 20 ? 'B' : 'A',
      label: 'Watch',
      headline: 'Pass on secrets. AI authorship signals are advisory only.',
      factors,
      live: 0,
      examples: 0,
      deleted: 0,
      blocking: 0,
      advisory: advisory.length,
    };
  }

  value = 35;
  factors.push({ key: 'fail', text: 'Merge gate failed on blocking secrets', weight: 35 });

  for (const finding of blocking) {
    const sev = SEV[finding.severity] || 5;
    value += sev;
  }
  factors.push({ key: 'severity', text: `${blocking.length} blocking finding${blocking.length === 1 ? '' : 's'} by severity`, weight: value - 35 });

  if (live) {
    value += live * 8;
    factors.push({ key: 'live', text: `${live} labeled likely live`, weight: live * 8 });
  }
  if (deleted) {
    value += deleted * 6;
    factors.push({ key: 'history', text: `${deleted} still recoverable from history after delete`, weight: deleted * 6 });
  }
  if (examples) {
    value = Math.max(35, value - examples * 4);
    factors.push({ key: 'example', text: `${examples} look like docs/fixtures (still fail until removed)`, weight: -(examples * 4) });
  }
  if (advisory.length) {
    value += Math.min(10, advisory.length * 2);
    factors.push({ key: 'advisory', text: `${advisory.length} AI advisory alongside secrets`, weight: Math.min(10, advisory.length * 2) });
  }

  value = Math.max(0, Math.min(100, Math.round(value)));
  const grade = value >= 85 ? 'F' : value >= 70 ? 'D' : value >= 55 ? 'C' : value >= 40 ? 'B' : 'A';
  const label = value >= 85 ? 'Critical' : value >= 70 ? 'Severe' : value >= 55 ? 'High' : 'Elevated';

  return {
    value,
    grade,
    label,
    headline: report?.muse?.summary
      ? String(report.muse.summary).slice(0, 280)
      : `${blocking.length} blocking secret${blocking.length === 1 ? '' : 's'} — rotate or remove before merge.`,
    factors: factors.slice(0, 8),
    live,
    examples,
    deleted,
    blocking: blocking.length,
    advisory: advisory.length,
  };
}

export function fixPlan(report) {
  const rotate = Array.isArray(report?.muse?.rotate) ? report.muse.rotate : [];
  const steps = [];
  for (const item of rotate) {
    const where = item.where || item.rule || 'finding';
    const itemSteps = Array.isArray(item.steps) ? item.steps : [];
    if (itemSteps.length) {
      for (const step of itemSteps.slice(0, 4)) {
        steps.push({ where, text: step, why: item.why_live || '', blast: item.blast || '' });
      }
    } else if (item.why_live) {
      steps.push({ where, text: item.why_live, why: '', blast: item.blast || '' });
    }
  }
  if (!steps.length) {
    const blocking = (report?.findings || []).filter((f) => !f.advisory);
    for (const finding of blocking.slice(0, 6)) {
      steps.push({
        where: `${finding.path}:${finding.line}`,
        text: `Revoke or rotate ${finding.rule}, purge ${finding.path} from history if needed, then redeploy without the secret in source.`,
        why: finding.why || '',
        blast: '',
      });
    }
  }
  return steps.slice(0, 16);
}
