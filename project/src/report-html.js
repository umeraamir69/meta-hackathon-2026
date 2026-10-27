import { whereOf } from './judge.js';

function escape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function counts(labels) {
  const map = new Map();
  for (const label of labels || []) map.set(label.label, (map.get(label.label) || 0) + 1);
  return [...map].map(([name, count]) => `${count} ${name.replaceAll('_', ' ')}`).join(' · ') || 'No labels';
}

export function renderReport(report, options = {}) {
  const hasReport = Boolean(report);
  const failed = hasReport && !report.ok;
  const labels = new Map((report?.muse?.labels || []).map((label) => [label.where, label]));
  const rows = (report?.findings || []).map((finding) => {
    const where = `${finding.source} ${finding.path}:${finding.line}`;
    const shown = labels.get(whereOf(finding));
    const context = (finding.context || []).map((row) => `L${row.line}  ${row.text}`).join('\n');
    return `<tr>
      <td>${escape(finding.severity)}</td>
      <td>${escape(finding.rule)}</td>
      <td><code>${escape(where)}${finding.removed ? ' removed' : ''}</code></td>
      <td>${escape(shown?.label || 'unclear')}</td>
      <td>${escape(shown?.why || '')}${context ? `<pre>${escape(context)}</pre>` : ''}</td>
    </tr>`;
  }).join('');
  const rotate = (report?.muse?.rotate || []).map((item) => (
    `<li><code>${escape(item.where)}</code><ol>${(item.steps || []).map((step) => `<li>${escape(step)}</li>`).join('')}</ol></li>`
  )).join('');
  const model = [report?.muse?.classifier?.model, report?.muse?.model].filter(Boolean).join(' then ') || 'local checklist';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PR Diff Sentinel</title>
  <style>
    :root { color-scheme: dark; --bg: #121417; --panel: #1b1f26; --line: #2c3340; --text: #e7ecf3; --muted: #9aa6b8; --fail: #ff6b6b; --pass: #7dcea0; --accent: #8eb6ff; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 "Iowan Old Style", Palatino, Georgia, serif; }
    main { max-width: 980px; margin: 0 auto; padding: 40px 20px 64px; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; border-bottom: 1px solid var(--line); padding-bottom: 20px; }
    h1 { font-size: 32px; line-height: 1.1; margin: 0; letter-spacing: -0.03em; }
    .status { font: 13px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: ${failed ? 'var(--fail)' : 'var(--pass)'}; }
    p { color: var(--muted); }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 24px 0; }
    .stat { background: var(--panel); padding: 14px 16px; }
    .stat b { display: block; font: 22px/1.2 ui-sans-serif, system-ui, sans-serif; color: var(--text); }
    .stat span { color: var(--muted); font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; }
    table { width: 100%; border-collapse: collapse; font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; }
    th, td { text-align: left; vertical-align: top; padding: 10px 8px; border-top: 1px solid var(--line); }
    th { color: var(--muted); font-weight: 600; }
    code, pre { font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
    pre { white-space: pre-wrap; color: var(--muted); margin: 8px 0 0; }
    section { margin-top: 28px; }
    h2 { font: 13px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
    a { color: var(--accent); }
    form { display: flex; gap: 8px; margin: 24px 0 8px; }
    input { flex: 1; min-width: 0; background: var(--panel); color: var(--text); border: 1px solid var(--line); padding: 12px 14px; font: 14px/1.4 ui-sans-serif, system-ui, sans-serif; }
    button { background: var(--accent); color: #121417; border: 0; padding: 0 16px; font: 14px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
    .error { color: var(--fail); }
    @media (max-width: 700px) { .stats, form { grid-template-columns: 1fr; display: grid; } header { display: block; } button { padding: 12px 16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>PR Diff Sentinel</h1>
        <p>Deterministic secret gate on the diff and git history. Muse labels hits. Muse does not clear them.</p>
      </div>
      ${hasReport ? `<div class="status">${failed ? 'Fail' : 'Pass'}</div>` : ''}
    </header>
    <form method="post" action="/scan">
      <label for="url" style="position:absolute;width:1px;height:1px;overflow:hidden;">GitHub repository or pull request</label>
      <input id="url" name="url" type="text" required value="${escape(options.url || '')}" placeholder="https://github.com/owner/repo or a pull request link" autocomplete="off">
      <button type="submit">Scan</button>
    </form>
    <p>Public GitHub repository or pull request. The clone runs on this computer, and secrets are masked before Muse sees them. <a href="/demo">Run the built-in demo</a></p>
    ${options.error ? `<p class="error">${escape(options.error)}</p>` : ''}
    ${options.source ? `<p>Scanned ${escape(options.source)}</p>` : ''}
    ${hasReport ? `<div class="stats">
      <div class="stat"><b>${escape(report.count)}</b><span>Findings blocking merge</span></div>
      <div class="stat"><b>${escape(report.suppressed)}</b><span>Suppressed by .sentinelignore</span></div>
      <div class="stat"><b>${escape(counts(report.muse?.labels))}</b><span>${escape(report.muse?.provider || 'no model')} · ${escape(model)}</span></div>
    </div>
    <table>
      <thead><tr><th>Severity</th><th>Rule</th><th>Where</th><th>Label</th><th>Why</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No findings.</td></tr>'}</tbody>
    </table>
    <section>
      <h2>Muse</h2>
      <p>${escape(report.muse?.summary || 'Nothing to explain.')}</p>
      ${rotate ? `<ol>${rotate}</ol>` : ''}
    </section>` : ''}
  </main>
</body>
</html>`;
}
