/** Match Muse rotate entry to a finding. */
export function rotateForFinding(report, finding) {
  const rotate = report?.muse?.rotate || [];
  const pathLine = finding?.path != null && finding?.line != null
    ? `${finding.path}:${finding.line}`
    : '';
  return rotate.find((item) => {
    const where = String(item.where || '');
    if (pathLine && where.includes(pathLine)) return true;
    if (finding?.path && where.includes(finding.path) && item.rule === finding.rule) return true;
    if (item.rule && item.rule === finding.rule && where.includes(String(finding.path || ''))) return true;
    return false;
  }) || null;
}

export function fixesForFinding(report, finding) {
  const rotate = rotateForFinding(report, finding);
  if (rotate?.steps?.length) {
    return rotate.steps.map((text) => ({
      text,
      why: rotate.why_live || '',
      blast: rotate.blast || '',
      where: rotate.where || `${finding.path}:${finding.line}`,
    }));
  }
  const pathLine = `${finding?.path || ''}:${finding?.line || ''}`;
  return (report?.fixes || []).filter((step) => {
    const where = String(step.where || '');
    return where.includes(pathLine) || (finding?.path && where.includes(finding.path));
  });
}

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    if (Boolean(a.advisory) !== Boolean(b.advisory)) return a.advisory ? 1 : -1;
    const liveA = a.label === 'likely_live' ? 0 : a.label === 'unclear' ? 1 : 2;
    const liveB = b.label === 'likely_live' ? 0 : b.label === 'unclear' ? 1 : 2;
    if (liveA !== liveB) return liveA - liveB;
    return (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9);
  });
}

export function buildReportDigest(report) {
  if (!report) return {};
  const findings = sortFindings(report.findings || []).slice(0, 20).map((f) => {
    const rotate = rotateForFinding(report, f);
    return {
      rule: f.rule,
      severity: f.severity,
      advisory: Boolean(f.advisory),
      label: f.label,
      why: f.why,
      source: f.source,
      path: f.path,
      line: f.line,
      masked: f.masked,
      removed: Boolean(f.removed),
      author: f.author || null,
      date: f.date || null,
      blast: rotate?.blast || '',
      steps: (rotate?.steps || []).slice(0, 4),
      why_live: rotate?.why_live || '',
    };
  });
  return {
    ok: report.ok,
    count: report.count,
    source: report.source,
    scope: report.scope,
    summary: report.muse?.summary || report.score?.headline || '',
    score: report.score?.value ?? null,
    grade: report.score?.grade || null,
    findings,
    fixes: (report.fixes || []).slice(0, 12),
  };
}
