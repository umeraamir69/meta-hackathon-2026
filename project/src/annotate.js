export function summaryText(report) {
  const lines = [`PR Diff Sentinel: ${report.ok ? 'PASS' : 'FAIL'} ${report.count} finding(s), ${report.suppressed} suppressed`];
  for (const finding of report.findings) {
    const where = `${finding.source} ${finding.path}:${finding.line}`;
    const removed = finding.removed ? ' removed' : '';
    const commit = finding.commit ? ` ${String(finding.commit).slice(0, 7)}` : '';
    const shown = finding.detail || finding.masked;
    lines.push(`  ${finding.severity} ${finding.rule} ${where}${removed}${commit} ${shown}`);
  }
  if (report.muse) {
    const model = report.muse.model ? ` ${report.muse.model}` : '';
    lines.push(`Muse: ${report.muse.provider}${model}`);
    if (report.muse.labels?.length) {
      const counts = new Map();
      for (const label of report.muse.labels) counts.set(label.label, (counts.get(label.label) || 0) + 1);
      lines.push(`Labels: ${[...counts].map(([name, count]) => `${count} ${name}`).join(', ')}`);
    }
    if (report.muse.summary) lines.push(report.muse.summary);
  }
  return `${lines.join('\n')}\n`;
}

export function annotationText(report) {
  const findings = Array.isArray(report) ? report : report.findings || [];
  if (process.env.GITHUB_ACTIONS !== 'true') return '';
  const errors = findings.map((finding) => {
    const usablePath = finding.path && finding.path !== 'commit-message' && !finding.path.includes(' ') && !finding.path.includes(',');
    const loc = usablePath ? ` file=${finding.path}${finding.line ? `,line=${finding.line}` : ''}` : '';
    const msg = `${finding.severity} ${finding.rule} ${finding.detail || finding.masked}`
      .replaceAll('%', '%25')
      .replaceAll('\r', '%0D')
      .replaceAll('\n', '%0A');
    return `::error${loc} title=PR Diff Sentinel::${msg}`;
  });
  const summary = Array.isArray(report) ? '' : (report.muse?.summary || '');
  if (summary) {
    const notice = summary.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    errors.push(`::notice title=PR Diff Sentinel::${notice}`);
  }
  return errors.join('\n') + (errors.length ? '\n' : '');
}
