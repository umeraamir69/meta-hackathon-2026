'use client';

import { useState } from 'react';

export default function Scanner() {
  const [url, setUrl] = useState('');
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
  return (
    <div className="report">
      <div className="verdict">
        <strong className={report.ok ? 'pass' : 'fail'}>{report.ok ? 'Pass' : 'Fail'}</strong>
        <span>{report.count} finding{report.count === 1 ? '' : 's'}</span>
      </div>
      <p className="source">{report.source}</p>
      <p className="scope">{report.scope}</p>
      {report.findings.length === 0 ? (
        <p className="clear">Nothing in this scan blocks the merge.</p>
      ) : (
        <ul className="findings">
          {report.findings.map((finding) => (
            <li key={`${finding.source}-${finding.path}-${finding.line}-${finding.rule}-${finding.removed}`}>
              <div className="finding-top">
                <b>{finding.rule}</b>
                <em>{pretty(finding.label) || 'unlabeled'}</em>
              </div>
              <code>
                {finding.source} {finding.path}:{finding.line}{finding.removed ? ' removed' : ''}
              </code>
              {finding.why ? <p>{finding.why}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {report.muse?.summary ? (
        <div className="muse">
          <span>Muse</span>
          <p>{report.muse.summary}</p>
        </div>
      ) : null}
    </div>
  );
}

function pretty(label) {
  return label ? String(label).replaceAll('_', ' ') : '';
}
