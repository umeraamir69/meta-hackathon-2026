'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cacheReport, reportPath } from '../lib/report-cache';
import { downloadReportPdf } from '../lib/report-pdf';
import { githubFindingUrl } from '../lib/github-link';

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

function modeFor(value) {
  return DIRECT_RE.test(value || '') ? 'direct' : 'list';
}

function chromeOffset(panel) {
  const chrome = panel?.querySelector?.('.panel-chrome');
  if (!chrome) return 16;
  return Math.ceil(chrome.getBoundingClientRect().height) + 12;
}

function scrollPanelTo(panel, el) {
  if (!panel || !el) return;
  const overflowY = window.getComputedStyle(panel).overflowY;
  const offset = chromeOffset(panel);
  if (overflowY === 'auto' || overflowY === 'scroll') {
    const delta = el.getBoundingClientRect().top - panel.getBoundingClientRect().top;
    panel.scrollTo({ top: Math.max(0, panel.scrollTop + delta - offset), behavior: 'smooth' });
    return;
  }
  const top = window.scrollY + el.getBoundingClientRect().top - offset - 64;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

export default function Scanner({ seedUrl = '', autoRun = false, compact = false } = {}) {
  const [url, setUrl] = useState(seedUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [listing, setListing] = useState(null);
  const [checked, setChecked] = useState([]);
  const [batch, setBatch] = useState(null);
  const [progress, setProgress] = useState(null);
  const [showPicker, setShowPicker] = useState(true);
  const [activeBatchUrl, setActiveBatchUrl] = useState('');
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const panelRef = useRef(null);
  const pickRef = useRef(null);
  const resultRef = useRef(null);
  const runId = useRef(0);
  const autoStarted = useRef(false);

  const mode = modeFor(url);
  const step = report ? 'result' : listing ? 'pick' : 'paste';
  const active = Boolean(listing || report || busy);

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('url') || '';
    const next = seedUrl || fromQuery;
    if (next) setUrl(next);
    setReady(true);
  }, [seedUrl]);

  useEffect(() => {
    const target = report ? resultRef.current : listing ? pickRef.current : null;
    if (!target || !panelRef.current) return;
    const timer = window.setTimeout(() => scrollPanelTo(panelRef.current, target), 40);
    return () => window.clearTimeout(timer);
  }, [listing, report, batch, showPicker, activeBatchUrl]);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    const next = new URL(window.location.href);
    if (url.trim()) next.searchParams.set('url', url.trim());
    else next.searchParams.delete('url');
    window.history.replaceState({}, '', next);
  }, [ready, url]);

  function clearResults() {
    setListing(null);
    setChecked([]);
    setBatch(null);
    setReport(null);
    setProgress(null);
    setShowPicker(true);
    setActiveBatchUrl('');
    setPhase('');
  }

  async function runTarget(targetUrl) {
    const trimmed = String(targetUrl || '').trim();
    if (!trimmed || busy) return;
    const id = ++runId.current;
    const direct = modeFor(trimmed) === 'direct';
    setUrl(trimmed);
    setBusy(true);
    setError('');
    clearResults();
    setPhase(direct
      ? 'Fetching the PR, then Muse triage (often 15–30s)…'
      : 'Listing public pull requests and commits…');
    try {
      if (direct) {
        const body = await postJson('/api/scan', { url: trimmed });
        if (runId.current !== id) return;
        cacheReport(trimmed, body);
        setReport(body);
      } else {
        const body = await postJson('/api/list', { url: trimmed });
        if (runId.current !== id) return;
        setListing(body);
        setShowPicker(true);
      }
    } catch (cause) {
      if (runId.current !== id) return;
      setError(cause.message || 'The scan failed.');
    } finally {
      if (runId.current === id) {
        setBusy(false);
        setPhase('');
      }
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    await runTarget(url);
  }

  useEffect(() => {
    if (!ready || autoStarted.current || busy) return;
    const fromQuery = typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('url') || '')
      : '';
    const target = (seedUrl || fromQuery || '').trim();
    if (!target || !autoRun) return;
    autoStarted.current = true;
    runTarget(target);
  }, [ready, seedUrl, autoRun]);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    setElapsed(0);
    const tick = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(tick);
  }, [busy]);

  function togglePick(itemUrl) {
    setChecked((prev) => {
      if (prev.includes(itemUrl)) return prev.filter((candidate) => candidate !== itemUrl);
      if (prev.length >= MAX_PICK) return prev;
      return [...prev, itemUrl];
    });
  }

  async function onScanPicked(event) {
    event.preventDefault();
    if (!checked.length || busy) return;
    const id = ++runId.current;
    setBusy(true);
    setError('');
    setBatch(null);
    setReport(null);
    setActiveBatchUrl('');
    const rows = [];
    const total = checked.length;
    for (let index = 0; index < checked.length; index += 1) {
      if (runId.current !== id) return;
      const itemUrl = checked[index];
      setProgress({ done: index, total, label: itemUrl });
      try {
        const body = await postJson('/api/scan', { url: itemUrl });
        cacheReport(itemUrl, body);
        rows.push({
          url: itemUrl,
          ok: body.ok,
          count: body.count ?? 0,
          advisory: body.advisory ?? 0,
          report: body,
        });
      } catch (cause) {
        rows.push({ url: itemUrl, ok: false, count: 0, advisory: 0, error: cause.message || 'The scan failed.' });
      }
      setBatch([...rows]);
      setProgress({ done: index + 1, total, label: itemUrl });
    }
    if (runId.current !== id) return;
    setProgress(null);
    setShowPicker(false);
    setBusy(false);
    const firstHit = rows.find((row) => row.report && !row.ok) || rows.find((row) => row.report);
    if (firstHit?.report) {
      setReport(firstHit.report);
      setActiveBatchUrl(firstHit.url);
    }
  }

  function openBatchRow(row) {
    if (row.report) {
      setReport(row.report);
      setActiveBatchUrl(row.url);
      setShowPicker(false);
      setError('');
    } else if (row.error) {
      setError(row.error);
    }
  }

  const submitLabel = !ready || busy
    ? (busy ? (mode === 'direct' ? 'Scanning…' : 'Loading…') : 'Go')
    : !url.trim()
      ? 'Go'
      : mode === 'direct'
        ? 'Scan PR'
        : 'List';

  const statusHint = busy
    ? (phase || (mode === 'direct'
      ? 'Fetching the PR, then Muse triage (often 15–30s)…'
      : 'Listing public pull requests and commits…'))
    : null;

  return (
    <section
      ref={panelRef}
      className={`panel${active ? ' panel-active' : ''}`}
      aria-busy={busy}
      data-step={step}
    >
      <div className="panel-chrome">
        <div className="steps-bar" aria-label="Scan steps">
          <span className={step === 'paste' ? 'on' : 'done'}>1 · Paste</span>
          <span className={step === 'pick' ? 'on' : listing || report ? 'done' : ''}>2 · Pick</span>
          <span className={step === 'result' ? 'on' : report ? 'done' : ''}>3 · Verdict</span>
        </div>

        <div className="panel-label">
          <span>Public GitHub</span>
          <span className={busy ? 'pulse' : ''}>
            {busy ? 'Working' : error ? 'Needs a public link' : 'Ready'}
          </span>
        </div>

        <form className="scan" onSubmit={onSubmit}>
          <label htmlFor="url" className="sr">GitHub repository or pull request</label>
          <input
            id="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/owner/repo or …/pull/123"
            autoComplete="off"
            spellCheck="false"
            required
          />
          <button type="submit" disabled={busy}>{submitLabel}</button>
        </form>

        <p className="note">
          {statusHint
            || (mode === 'direct'
              ? 'Scans this pull request diff and its recent commits.'
              : 'Repo links open a picker. Pull request links scan immediately.')}
        </p>

        {error ? <p className="error" role="alert">{error}</p> : null}

        {busy ? (
          <ScanLoader
            phase={statusHint || phase}
            elapsed={elapsed}
            direct={mode === 'direct'}
          />
        ) : null}
      </div>

      {report ? (
        <Report
          report={report}
          scanUrl={url}
          compact={compact}
          onClear={clearResults}
          anchorRef={resultRef}
        />
      ) : null}

      {listing ? (
        <Picker
          listing={listing}
          checked={checked}
          busy={busy}
          batch={batch}
          progress={progress}
          showPicker={showPicker}
          activeBatchUrl={activeBatchUrl}
          anchorRef={pickRef}
          onToggle={togglePick}
          onScan={onScanPicked}
          onOpenRow={openBatchRow}
          onTogglePicker={() => setShowPicker((value) => !value)}
          onReset={() => {
            clearResults();
            setError('');
          }}
        />
      ) : null}

      {!listing && !report && !error && !busy ? <Waiting busy={false} phase="" /> : null}
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

function Picker({
  listing,
  checked,
  busy,
  batch,
  progress,
  showPicker,
  activeBatchUrl,
  anchorRef,
  onToggle,
  onScan,
  onOpenRow,
  onTogglePicker,
  onReset,
}) {
  const items = useMemo(
    () => [...(listing.pulls || []), ...(listing.commits || [])],
    [listing],
  );
  const byUrl = new Map(items.map((item) => [item.url, item]));
  const picked = checked.map((itemUrl) => byUrl.get(itemUrl)).filter(Boolean);
  const full = checked.length >= MAX_PICK;
  const pulls = items.filter((item) => item.kind === 'pull');
  const commits = items.filter((item) => item.kind === 'commit');
  const empty = pulls.length === 0 && commits.length === 0;

  return (
    <div className="report pick-panel" ref={anchorRef}>
      <div className="pick-head">
        <div>
          <p className="pick-kicker">Step 2</p>
          <h2 className="pick-title">{batch ? 'Batch results' : 'Pick what to scan'}</h2>
        </div>
        <div className="pick-actions">
          <span className="source-chip">{listing.source}</span>
          <button type="button" className="ghost" onClick={onReset} disabled={busy}>
            Start over
          </button>
        </div>
      </div>

      <p className="scope">
        {batch
          ? 'Click a row to open the full verdict above. Change selection to scan again.'
          : `Tick up to ${MAX_PICK} pull requests or commits, then scan them together.`}
      </p>

      {progress ? (
        <div className="progress" role="status">
          <div className="bar">
            <i style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
          <p>
            Checking {Math.min(progress.done + (busy ? 1 : 0), progress.total)}/{progress.total}
            {progress.label ? ` — ${progress.label.replace('https://github.com/', '')}` : ''}
          </p>
        </div>
      ) : null}

      {batch ? (
        <BatchResults
          rows={batch}
          items={items}
          activeUrl={activeBatchUrl}
          onOpen={onOpenRow}
        />
      ) : null}

      {batch ? (
        <button type="button" className="ghost linkish" onClick={onTogglePicker}>
          {showPicker ? 'Hide selection list' : 'Change selection'}
        </button>
      ) : null}

      {picked.length > 0 && showPicker ? (
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

      {showPicker ? (
        <form onSubmit={onScan} className="pick-form">
          {empty ? (
            <p className="empty-pick">No open pull requests or recent commits found for this repo.</p>
          ) : (
            <div className="pick-scroll">
              {pulls.length ? (
                <>
                  <p className="group-label">Pull requests</p>
                  <PickList items={pulls} checked={checked} busy={busy} full={full} onToggle={onToggle} />
                </>
              ) : null}
              {commits.length ? (
                <>
                  <p className="group-label">Recent commits</p>
                  <PickList items={commits} checked={checked} busy={busy} full={full} onToggle={onToggle} />
                </>
              ) : null}
            </div>
          )}
          <div className="scan-dock">
            <button type="submit" className="cta" disabled={busy || checked.length === 0}>
              {busy ? 'Scanning…' : `Scan ${checked.length || ''} selected`.trim()}
            </button>
            <span className="count-note">{checked.length}/{MAX_PICK} picked</span>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function PickList({ items, checked, busy, full, onToggle }) {
  return (
    <ul className="findings pick">
      {items.map((item) => {
        const id = `pick-${item.kind}-${item.sha || item.number}`;
        const on = checked.includes(item.url);
        const disabled = busy || (!on && full);
        return (
          <li key={item.url} className={on ? 'is-checked' : ''}>
            <label htmlFor={id}>
              <input
                id={id}
                type="checkbox"
                checked={on}
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
  );
}

function BatchResults({ rows, items, activeUrl, onOpen }) {
  const byUrl = new Map(items.map((item) => [item.url, itemLabel(item)]));
  const clean = rows.filter((row) => row.ok && !row.error).length;
  return (
    <div className="batch">
      <p className="batch-summary">
        <strong>{clean}/{rows.length} clean</strong>
        <span>Click a row for the full report</span>
      </p>
      <ul className="findings">
        {rows.map((row) => (
          <li key={row.url} className={row.url === activeUrl ? 'is-active' : ''}>
            <button type="button" className="batch-row" onClick={() => onOpen(row)}>
              <div className="finding-top">
                <b className={`sev ${row.ok && !row.error ? '' : 'high'}`}>{byUrl.get(row.url) || row.url}</b>
                <em>{row.error ? 'error' : row.ok ? 'clean' : `${row.count} blocking`}</em>
              </div>
              <code>
                {row.error
                  || `${row.count} finding${row.count === 1 ? '' : 's'}${row.advisory ? ` · ${row.advisory} AI signal${row.advisory === 1 ? '' : 's'}` : ''}`}
              </code>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Waiting({ busy, phase }) {
  return (
    <p className={`waiting${busy ? ' pulse-text' : ''}`} role={busy ? 'status' : undefined}>
      {busy
        ? (phase || 'Fetching GitHub, then Muse triage (often 15–30s)…')
        : 'Paste a pull request to get a Pass or Fail. Paste a repo to pick PRs and commits.'}
    </p>
  );
}

function ScanLoader({ phase, elapsed, direct }) {
  const pct = Math.min(92, Math.round((elapsed / 28) * 100));
  const stage = !direct
    ? 'Listing repo'
    : elapsed < 6
      ? 'Reading GitHub'
      : elapsed < 14
        ? 'Matching secrets'
        : 'Muse triage';
  return (
    <div className="scan-loader" role="status" aria-live="polite">
      <div className="scan-loader-top">
        <span className="scan-spinner" aria-hidden="true" />
        <div>
          <p className="scan-loader-stage">{stage}</p>
          <p className="scan-loader-phase">{phase || 'Working…'}</p>
        </div>
        <span className="scan-loader-time">{elapsed}s</span>
      </div>
      <div className="scan-loader-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="scan-loader-hint">
        {direct
          ? 'Secret gate + Muse usually finish in 15–30 seconds. Keep this tab open.'
          : 'Fetching open PRs and recent commits…'}
      </p>
    </div>
  );
}

function githubBrowseUrl(source) {
  if (!source) return null;
  const pull = String(source).match(/^([^/]+\/[^/#]+)#(\d+)$/);
  if (pull) return `https://github.com/${pull[1]}/pull/${pull[2]}`;
  const commit = String(source).match(/^([^/]+\/[^/#]+)@([0-9a-f]{7,40})$/i);
  if (commit) return `https://github.com/${commit[1]}/commit/${commit[2]}`;
  if (/^[^/]+\/[^/]+$/.test(source)) return `https://github.com/${source}`;
  return null;
}

function Report({ report, onClear, anchorRef, compact = false, scanUrl = '' }) {
  const [copied, setCopied] = useState('');
  const blocking = (report.findings || []).filter((finding) => !finding.advisory);
  const advisory = (report.findings || []).filter((finding) => finding.advisory);
  const live = blocking.filter((finding) => finding.label === 'likely_live').length;
  const examples = blocking.filter((finding) => finding.label === 'likely_example' || finding.label === 'likely_fixture').length;
  const deleted = blocking.filter((finding) => finding.presentInTree === false).length;
  const githubUrl = githubBrowseUrl(report.source);
  const targetUrl = scanUrl || githubUrl || '';

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied('json');
    setTimeout(() => setCopied(''), 1600);
  }

  async function copyShare() {
    const share = `${window.location.origin}/?url=${encodeURIComponent(targetUrl || report.source || '')}`;
    await navigator.clipboard.writeText(share);
    setCopied('share');
    setTimeout(() => setCopied(''), 1600);
  }

  function downloadPdf() {
    downloadReportPdf(report, {
      url: targetUrl,
      fromCache: false,
      savedAt: Date.now(),
    });
  }

  function openFullReport() {
    // Same-tab handoff: report is already stashed (memory + session + localStorage).
    // A new tab used to re-hit /api/scan whenever storage missed — never again from this button.
    window.location.assign(reportPath(targetUrl, report));
  }

  if (compact) {
    return (
      <div className="report report-verdict report-compact" ref={anchorRef}>
        <div className="verdict">
          <strong className={report.ok ? 'pass' : 'fail'}>{report.ok ? 'Pass' : 'Fail'}</strong>
          <span>
            {report.count} blocking
            {advisory.length
              ? ` · ${advisory.length} AI advisor${advisory.length === 1 ? 'y' : 'ies'}`
              : ''}
          </span>
        </div>
        <p className="source">{report.source}</p>
        <p className="scope">{report.scope}</p>
        {blocking.length > 0 || advisory.length > 0 ? (
          <div className="stat-row" aria-label="Finding summary">
            <span><b>{blocking.length}</b> blocking</span>
            {live ? <span><b>{live}</b> likely live</span> : null}
            {examples ? <span><b>{examples}</b> sample/fixture</span> : null}
            {deleted ? <span><b>{deleted}</b> deleted from files</span> : null}
            {advisory.length ? <span><b>{advisory.length}</b> AI advisory</span> : null}
          </div>
        ) : null}
        {report.muse?.summary ? (
          <p className="compact-muse">{report.muse.summary}</p>
        ) : null}
        <div className="compact-actions">
          <button type="button" className="cta" onClick={openFullReport}>
            Open full report
          </button>
          {githubUrl ? (
            <a className="ghost" href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
          ) : null}
          {onClear ? (
            <button type="button" className="ghost" onClick={onClear}>Clear</button>
          ) : null}
        </div>
        <p className="compact-hint">Opens the saved report here — no second scan. Use Rescan on the report page if you want a fresh run.</p>
      </div>
    );
  }

  return (
    <div className="report report-verdict" ref={anchorRef}>
      <div className="verdict">
        <strong className={report.ok ? 'pass' : 'fail'}>{report.ok ? 'Pass' : 'Fail'}</strong>
        <span>
          {report.count} blocking
          {advisory.length
            ? ` · ${advisory.length} AI advisor${advisory.length === 1 ? 'y' : 'ies'}`
            : ''}
        </span>
      </div>
      <div className="report-meta">
        <p className="source">{report.source}</p>
        <div className="report-tools">
          {githubUrl ? (
            <a className="ghost" href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
          ) : null}
          <button type="button" className="ghost" onClick={copyShare}>
            {copied === 'share' ? 'Copied' : 'Share'}
          </button>
          <button type="button" className="ghost" onClick={copyJson}>
            {copied === 'json' ? 'Copied' : 'Copy JSON'}
          </button>
          <button type="button" className="ghost" onClick={downloadPdf}>Download PDF</button>
          {onClear ? (
            <button type="button" className="ghost" onClick={onClear}>Clear</button>
          ) : null}
        </div>
      </div>
      <p className="scope">{report.scope}</p>
      {blocking.length > 0 || advisory.length > 0 ? (
        <div className="stat-row" aria-label="Finding summary">
          <span><b>{blocking.length}</b> blocking</span>
          {live ? <span><b>{live}</b> likely live</span> : null}
          {examples ? <span><b>{examples}</b> sample/fixture</span> : null}
          {deleted ? <span><b>{deleted}</b> deleted from files</span> : null}
          {advisory.length ? <span><b>{advisory.length}</b> AI advisory · never blocks</span> : null}
        </div>
      ) : null}
      {blocking.length === 0 ? (
        <p className="clear">
          {advisory.length
            ? 'Pass — no secrets block the merge. AI signals below are advisory only.'
            : 'Nothing in this scan blocks the merge.'}
        </p>
      ) : (
        <ul className="findings">
          {blocking.map((finding) => {
            const fileUrl = githubFindingUrl(report, finding);
            return (
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
                {fileUrl ? (
                  <p className="finding-actions">
                    <a href={fileUrl} target="_blank" rel="noreferrer">Open file on GitHub</a>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {advisory.length > 0 ? <AiSignals report={report} advisory={advisory} /> : null}
      {report.muse?.summary || (report.muse?.rotate || []).length ? (
        <MusePanel muse={report.muse} />
      ) : null}
    </div>
  );
}

function MusePanel({ muse }) {
  const rotate = Array.isArray(muse?.rotate) ? muse.rotate : [];
  const ignore = Array.isArray(muse?.ignore) ? muse.ignore : [];
  return (
    <div className="muse">
      <span>Muse · {muse.provider || 'local'}{muse.model ? ` · ${muse.model}` : ''}</span>
      {muse.summary ? <p>{muse.summary}</p> : null}
      {rotate.length > 0 ? (
        <ol className="rotate">
          {rotate.slice(0, 8).map((item) => (
            <li key={`${item.where}-${item.rule}`}>
              <code>{item.where || item.rule}</code>
              {item.why_live ? <p className="why-live">{item.why_live}</p> : null}
              {item.blast ? <p className="blast">Blast: {item.blast}</p> : null}
              {item.fix?.path ? (
                <pre className="fix-patch">{`--- a/${item.fix.path}\n+++ b/${item.fix.path}\n- ${item.fix.before || ''}\n+ ${item.fix.after || ''}`}</pre>
              ) : null}
              <ul>
                {(item.steps || []).slice(0, 4).map((step) => <li key={step}>{step}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
      {ignore.length > 0 ? (
        <div className="ignore-box">
          <span>.sentinelignore candidates</span>
          <ul>
            {ignore.slice(0, 6).map((item) => (
              <li key={item.pattern}>
                <code>{item.pattern}</code>
                {item.reason ? <p>{item.reason}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function pretty(label) {
  return label ? String(label).replaceAll('_', ' ') : '';
}

function AiSignals({ report, advisory }) {
  const [open, setOpen] = useState(Boolean(report.muse?.assessment));
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
