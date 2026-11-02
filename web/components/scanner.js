'use client';

import { useState } from 'react';

const MAX_PICK = 10;
const DIRECT_RE = /github\.com\/[^/]+\/[^/]+\/(pull|commits?)\//;

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The request failed.');
  return body;
}

export default function Scanner() {
  const [url, setUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('url') || '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [listing, setListing] = useState(null);
  const [checked, setChecked] = useState([]);
  const [batch, setBatch] = useState(null);
  const [progress, setProgress] = useState(null);

  function resetPick() {
    setListing(null);
    setChecked([]);
    setBatch(null);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setReport(null);
    resetPick();
    try {
      if (DIRECT_RE.test(url)) {
        setReport(await postJson('/api/scan', { url }));
      } else {
        setListing(await postJson('/api/list', { url }));
      }
    } catch (cause) {
      setError(cause.message || 'The scan failed.');
    } finally {
      setBusy(false);
    }
  }

  function togglePick(itemUrl) {
    setChecked((prev) => {
      if (prev.includes(itemUrl)) return prev.filter((candidate) => candidate !== itemUrl);
      if (prev.length >= MAX_PICK) return prev;
      return [...prev, itemUrl];
    });
  }

  async function onScanPicked(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setBatch(null);
    const rows = [];
    const total = checked.length;
    for (let index = 0; index < checked.length; index += 1) {
      const itemUrl = checked[index];
      setProgress({ done: index, total, label: itemUrl });
      try {
        const body = await postJson('/api/scan', { url: itemUrl });
        rows.push({ url: itemUrl, ok: body.ok, count: body.count ?? 0, advisory: body.advisory ?? 0 });
      } catch (cause) {
        rows.push({ url: itemUrl, ok: false, count: 0, advisory: 0, error: cause.message || 'The scan failed.' });
      }
      setBatch([...rows]);
      setProgress({ done: index + 1, total, label: itemUrl });
    }
    setProgress(null);
    setBusy(false);
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
      {listing ? (
        <Picker
          listing={listing}
          checked={checked}
          busy={busy}
          batch={batch}
          progress={progress}
          onToggle={togglePick}
          onScan={onScanPicked}
        />
      ) : null}
      {report ? <Report report={report} /> : listing ? null : <Waiting busy={busy} />}
    </section>
  );
}

function itemLabel(item) {
  if (item.kind === 'pull') return `#${item.number} ${item.title}`;
  return `${(item.sha || '').slice(0, 7)} ${item.subject}`;
}

function GitHubMark() {
  return (
    <svg className="gh-mark" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

function Avatar({ item }) {
  if (!item.avatar) return <span className="avatar empty" aria-hidden="true" />;
  return <img className="avatar" src={item.avatar} alt="" width="22" height="22" loading="lazy" />;
}

function Picker({ listing, checked, busy, batch, progress, onToggle, onScan }) {
  const items = [...(listing.pulls || []), ...(listing.commits || [])];
  const byUrl = new Map(items.map((item) => [item.url, item]));
  const picked = checked.map((url) => byUrl.get(url)).filter(Boolean);
  const full = checked.length >= MAX_PICK;
  return (
    <div className="report">
      <div className="verdict">
        <strong className={batch && batch.every((row) => row.ok) ? 'pass' : ''}>
          {batch ? `${batch.filter((row) => row.ok).length}/${batch.length} clean` : 'Pick to scan'}
        </strong>
        <span>{listing.source}</span>
      </div>
      {progress ? (
        <div className="progress" role="status">
          <div className="bar">
            <i style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
          <p>
            Checking {Math.min(progress.done + 1, progress.total)}/{progress.total} — {progress.label}
          </p>
        </div>
      ) : null}
      {batch ? <BatchResults rows={batch} items={items} /> : null}
      {picked.length > 0 && !batch ? (
        <div className="tray">
          <span className="tray-label">Selected {picked.length}/{MAX_PICK}</span>
          <ul>
            {picked.map((item) => (
              <li key={item.url}>
                <Avatar item={item} />
                <span>{itemLabel(item)}</span>
                <button type="button" onClick={() => onToggle(item.url)} aria-label={`Remove ${itemLabel(item)}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="scope">Tick up to {MAX_PICK} commits or pull requests, then scan them together.</p>
      <form onSubmit={onScan}>
        <ul className="findings pick">
          {items.map((item) => {
            const id = `pick-${item.kind}-${item.sha || item.number}`;
            const disabled = busy || (!checked.includes(item.url) && full);
            return (
              <li key={item.url}>
                <label htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked.includes(item.url)}
                    disabled={disabled}
                    onChange={() => onToggle(item.url)}
                  />
                  <Avatar item={item} />
                  <span>
                    <b>{itemLabel(item)}</b>
                    <span className="pick-meta">
                      <GitHubMark /> {item.author}
                      {item.date ? ` · ${item.date}` : ''}{item.state ? ` · ${item.state}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="scan-row">
          <button type="submit" className="cta" disabled={busy || checked.length === 0}>
            {busy ? 'Scanning…' : `Scan ${checked.length} selected`}
          </button>
          <span className="count-note">{checked.length}/{MAX_PICK} picked</span>
        </p>
      </form>
    </div>
  );
}

function BatchResults({ rows, items }) {
  const byUrl = new Map(items.map((item) => [item.url, itemLabel(item)]));
  return (
    <ul className="findings">
      {rows.map((row) => (
        <li key={row.url}>
          <div className="finding-top">
            <b className={`sev ${row.ok ? '' : 'high'}`}>{byUrl.get(row.url) || row.url}</b>
            <em>{row.error ? 'error' : row.ok ? 'clean' : `${row.count} blocking`}</em>
          </div>
          <code>{row.error || `${row.count} finding${row.count === 1 ? '' : 's'}${row.advisory ? ` · ${row.advisory} AI signal${row.advisory === 1 ? '' : 's'}` : ''}`}</code>
        </li>
      ))}
    </ul>
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
        <AiSignals report={report} advisory={advisory} />
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

function AiSignals({ report, advisory }) {
  const [open, setOpen] = useState(false);
  const assessment = report.muse?.assessment || null;
  const verdict = assessment?.verdict;
  return (
    <div className="ai-signals">
      <button type="button" className="ai-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>
          AI signals · {advisory.length} advisory, never blocks
          {verdict ? ` · ${String(verdict).replaceAll('_', ' ')}` : ''}
        </span>
        <span className={`ai-caret${open ? ' open' : ''}`} aria-hidden="true">▸</span>
      </button>
      {open ? (
        <div className="ai-body">
          {assessment ? (
            <>
              <p className="verdict">
                Muse verdict: {String(assessment.verdict || 'unclear').replaceAll('_', ' ')} ({assessment.confidence || 'low'} confidence)
              </p>
              {(assessment.evidence || []).map((item, index) => (
                item && (item.signal || item.why) ? (
                  <p key={index} className="ai-evidence">
                    <b>{item.signal || 'signal'}</b>
                    {item.why ? <span> — {item.why}</span> : null}
                  </p>
                ) : null
              ))}
              {(assessment.review_focus || []).map((focus) => (
                <p key={focus} className="ai-focus">Check: {focus}</p>
              ))}
              {(assessment.notes || []).filter(Boolean).map((note) => (
                <p key={note} className="ai-note">{note}</p>
              ))}
            </>
          ) : (
            <p className="ai-note">No model key on the server, so this is Layer 1 only — the signals below, no verdict.</p>
          )}
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
    </div>
  );
}

function caseLine(finding) {
  const bits = [];
  if (finding.author) bits.push(`by ${finding.author}`);
  if (finding.date) bits.push(finding.date);
  if (finding.presentInTree === false) bits.push('deleted from current files, still in git');
  return bits.join(' · ');
}
