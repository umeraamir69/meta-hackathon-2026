'use client';

import { useState } from 'react';

export default function Scanner() {
  const [url, setUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('url') || '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The scan failed.');
      setReport(body);
    } catch (cause) {
      setReport(null);
      setError(cause.message || 'The scan failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-busy={busy}>
      <div className="panel-label">
        <span>Public GitHub</span>
        <span>{busy ? 'Scanning' : 'Ready'}</span>
      </div>
      <form className="scan" onSubmit={onSubmit}>
        <label htmlFor="url" className="sr">GitHub repository or pull request</label>
        <input
          id="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          autoComplete="off"
          spellCheck="false"
          required
        />
        <button type="submit" disabled={busy}>{busy ? 'Scanning' : 'Scan'}</button>
      </form>
      <p className="note">Pull request diff and its recent commits. Full history stays on the local gate.</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {report ? <Report report={report} /> : <Waiting busy={busy} />}
    </section>
  );
}

function Waiting({ busy }) {
  return (
    <p className="waiting">{busy ? 'Reading the diff and the recent commits.' : 'The verdict replaces this.'}</p>
  );
}

function Report({ report }) {
  const blocking = (report.findings || []).filter((finding) => !finding.advisory);
  const advisory = (report.findings || []).filter((finding) => finding.advisory);
  return (
    <div className="report">
      <div className="verdict">
        <strong className={report.ok ? 'pass' : 'fail'}>{report.ok ? 'Pass' : 'Fail'}</strong>
        <span>{report.count} finding{report.count === 1 ? '' : 's'}</span>
      </div>
      <p className="source">{report.source}</p>
      <p className="scope">{report.scope}</p>
      {blocking.length === 0 ? (
        <p className="clear">Nothing in this scan blocks the merge.</p>
      ) : (
        <ul className="findings">
          {blocking.map((finding) => (
            <li key={`${finding.source}-${finding.path}-${finding.line}-${finding.rule}-${finding.removed}`}>
              <div className="finding-top">
                <b className={`sev ${finding.severity || ''}`}>{finding.rule}</b>
                <em>{pretty(finding.label) || 'unlabeled'}</em>
              </div>
              <code>
                {finding.source} {finding.path}:{finding.line}{finding.removed ? ' removed' : ''}{finding.encoding ? ` encoded ${finding.encoding}` : ''}
              </code>
              {finding.masked ? <code className="masked">{finding.masked}</code> : null}
              {caseLine(finding) ? <p className="case">{caseLine(finding)}</p> : null}
              {finding.why ? <p>{finding.why}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {advisory.length > 0 ? (
        <div className="ai-signals">
          <span>AI signals · advisory, never blocks</span>
          {report.muse?.assessment ? (
            <p className="verdict">Muse verdict: {String(report.muse.assessment.verdict).replaceAll('_', ' ')} ({report.muse.assessment.confidence || 'low'} confidence)</p>
          ) : null}
          <ul>
            {advisory.map((finding) => (
              <li key={`${finding.rule}-${finding.path}-${finding.line}`}>
                <b>{finding.rule}</b>
                <code>{finding.source} {finding.path}:{finding.line}</code>
                {finding.masked ? <p>{finding.masked}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {report.muse?.summary ? (
        <div className="muse">
          <span>Muse · {report.muse.provider || 'local'}</span>
          <p>{report.muse.summary}</p>
          {Array.isArray(report.muse.rotate) && report.muse.rotate.length > 0 ? (
            <ol className="rotate">
              {report.muse.rotate.slice(0, 6).map((item) => (
                <li key={item.where}>
                  <code>{item.where}</code>
                  <ul>
                    {(item.steps || []).slice(0, 3).map((step) => <li key={step}>{step}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function pretty(label) {
  return label ? String(label).replaceAll('_', ' ') : '';
}

function caseLine(finding) {
  const bits = [];
  if (finding.author) bits.push(`by ${finding.author}`);
  if (finding.date) bits.push(finding.date);
  if (finding.presentInTree === false) bits.push('deleted from current files, still in git');
  return bits.join(' · ');
}
