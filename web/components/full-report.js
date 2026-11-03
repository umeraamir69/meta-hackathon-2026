'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cacheReport, readById, readCachedReport } from '../lib/report-cache';
import { githubFindingUrl } from '../lib/github-link';
import { downloadReportPdf } from '../lib/report-pdf';
import FindingMuseModal from './finding-muse-modal';
import MuseChat from './muse-chat';

function pretty(label) {
  return label ? String(label).replaceAll('_', ' ') : 'unlabeled';
}

function when(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

function FindingCard({ finding, index, report, onOpenMuse }) {
  const fileUrl = githubFindingUrl(report, finding);
  const severity = finding.severity || 'medium';
  return (
    <li className={`mgr-finding-card sev-${severity}${finding.advisory ? ' is-advisory' : ''}`}>
      <div className="mgr-finding-top">
        <div className="mgr-finding-title">
          <strong>{String(index + 1).padStart(2, '0')} · {finding.rule}</strong>
          <div className="mgr-finding-pills">
            <span className={`muse-badge sev-${severity}`}>{severity}</span>
            <span className="muse-badge soft">{pretty(finding.label)}</span>
          </div>
        </div>
        <button
          type="button"
          className="muse-icon-btn"
          onClick={() => onOpenMuse(finding, index)}
          aria-label={`Ask Muse about ${finding.rule}`}
          title="Muse explains this finding"
        >
          <span aria-hidden="true">✦</span>
          Muse
        </button>
      </div>

      <p className="mgr-finding-loc">
        <code>{finding.source} · {finding.path}{finding.line != null ? `:${finding.line}` : ''}</code>
        {finding.removed ? <span className="mgr-pill">removed</span> : null}
        {finding.encoding ? <span className="mgr-pill">encoded {finding.encoding}</span> : null}
      </p>

      {finding.masked ? <p className="mgr-finding-secret"><code>{finding.masked}</code></p> : null}

      {finding.author || finding.date ? (
        <p className="mgr-finding-meta">{[finding.author, finding.date].filter(Boolean).join(' · ')}</p>
      ) : null}

      {finding.why ? <p className="mgr-finding-why">{finding.why}</p> : null}

      <div className="mgr-finding-actions">
        {fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noreferrer">Open file on GitHub</a>
        ) : null}
        <button type="button" className="ghost" onClick={() => onOpenMuse(finding, index)}>
          Why &amp; how to fix
        </button>
      </div>
    </li>
  );
}

export default function FullReport() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [seedQuestion, setSeedQuestion] = useState('');
  const [activeFinding, setActiveFinding] = useState(null);

  async function fetchLive(trimmed) {
    setBusy(true);
    setFromCache(false);
    const started = Date.now();
    const tick = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The scan failed.');
      cacheReport(trimmed, body);
      setReport(body);
      setSavedAt(Date.now());
      setFromCache(false);
      setError('');
    } catch (cause) {
      setError(cause.message || 'The scan failed.');
    } finally {
      window.clearInterval(tick);
      setBusy(false);
      setElapsed(0);
    }
  }

  async function load({ force = false } = {}) {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('rid') || '';
    const target = (params.get('url') || url || '').trim();
    if (target) setUrl(target);
    setError('');
    setBusy(false);

    if (!force) {
      if (rid) {
        const entry = readById(rid);
        if (entry?.report) {
          setReport(entry.report);
          setFromCache(true);
          setSavedAt(entry.savedAt || Date.now());
          if (entry.url) setUrl(entry.url);
          return;
        }
        setReport(null);
        setFromCache(false);
        setError(
          target
            ? 'Saved report was not found in this browser. Click Rescan to run GitHub + Muse again.'
            : 'Saved report was not found in this browser.',
        );
        return;
      }
      if (target) {
        const cached = readCachedReport(target);
        if (cached) {
          setReport(cached);
          setFromCache(true);
          setSavedAt(Date.now());
          return;
        }
      }
    }

    if (!target) {
      setError('Missing report id or GitHub URL.');
      return;
    }
    setReport(null);
    await fetchLive(target);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 1100px)');
    function sync() {
      if (mq.matches) setChatOpen(false);
    }
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const score = report?.score;
  const blocking = (report?.findings || []).filter((f) => !f.advisory);
  const advisory = (report?.findings || []).filter((f) => f.advisory);
  const fixes = report?.fixes || [];
  const rotate = report?.muse?.rotate || [];
  const ignore = report?.muse?.ignore || [];

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  }

  function downloadPdf() {
    downloadReportPdf(report, { url, fromCache, savedAt });
  }

  function openFindingMuse(finding, index) {
    setActiveFinding({ finding, index });
  }

  function askMuse(question) {
    setActiveFinding(null);
    setSeedQuestion(question);
    setChatOpen(true);
  }

  return (
    <div className={`mgr${report ? ' has-report' : ''}${chatOpen && report ? ' chat-open' : ''}`}>
      <div className="mgr-toolbar">
        <div className="mgr-toolbar-links">
          <Link href="/testing">← Testing</Link>
          <Link href={`/?url=${encodeURIComponent(url || '')}`}>Scanner</Link>
          {url ? <a href={url} target="_blank" rel="noreferrer">GitHub</a> : null}
        </div>
        <div className="mgr-toolbar-actions">
          {report ? (
            <>
              <button type="button" className="mgr-btn" onClick={copyJson}>Copy JSON</button>
              <button type="button" className="mgr-btn mgr-btn-primary" onClick={downloadPdf}>Download PDF</button>
              <button
                type="button"
                className={`mgr-btn muse-toggle${chatOpen ? ' is-on' : ''}`}
                onClick={() => setChatOpen((value) => !value)}
              >
                {chatOpen ? 'Hide Muse chat' : 'Chat with Muse'}
              </button>
            </>
          ) : null}
          {url ? (
            <button type="button" className="mgr-btn" onClick={() => load({ force: true })}>
              Rescan
            </button>
          ) : null}
        </div>
      </div>

      {busy ? (
        <div className="scan-loader full-loader" role="status">
          <div className="scan-loader-top">
            <span className="scan-spinner" aria-hidden="true" />
            <div>
              <p className="scan-loader-stage">Building merge gate report</p>
              <p className="scan-loader-phase">Fetching PR and Muse triage…</p>
            </div>
            <span className="scan-loader-time">{elapsed}s</span>
          </div>
          <div className="scan-loader-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(92, Math.round((elapsed / 28) * 100))}%` }} />
          </div>
        </div>
      ) : null}

      {error ? <p className="error" role="alert">{error}</p> : null}

      {report ? (
        <div className="mgr-layout">
          <article className="mgr-sheet">
            <header className="mgr-masthead">
              <div className="mgr-brand">
                <i aria-hidden="true" />
                <span>PR Diff Sentinel</span>
              </div>
              <p className="mgr-doctype">Merge gate report</p>
              <h1>{report.source}</h1>
              <p className="mgr-deck">{score?.headline || report.muse?.summary || report.scope}</p>
              <dl className="mgr-meta">
                <div>
                  <dt>Scope</dt>
                  <dd>{report.scope}</dd>
                </div>
                <div>
                  <dt>Generated</dt>
                  <dd>{fromCache ? `Cached · ${when(savedAt)}` : `Live · ${when(savedAt || Date.now())}`}</dd>
                </div>
                <div>
                  <dt>Muse</dt>
                  <dd>{report.muse?.provider || 'local'}{report.muse?.model ? ` · ${report.muse.model}` : ''}</dd>
                </div>
                {report.owner && report.repo ? (
                  <div>
                    <dt>Repository</dt>
                    <dd>{report.owner}/{report.repo}{report.pull ? ` · PR #${report.pull}` : ''}</dd>
                  </div>
                ) : null}
              </dl>
            </header>

            <section className={`mgr-gate ${report.ok ? 'is-pass' : 'is-fail'}`} aria-label="Merge gate">
              <div className="mgr-gate-verdict">
                <p className="mgr-label">Merge gate</p>
                <p className="mgr-gate-word">{report.ok ? 'Pass' : 'Fail'}</p>
                <p className="mgr-gate-note">
                  {report.ok
                    ? 'No blocking secrets. Safe to merge from the secrets gate. AI advisories never flip this.'
                    : 'Blocking secrets found. Do not merge until rotate or remove. Muse cannot clear this fail.'}
                </p>
              </div>
              <div className={`mgr-gate-score grade-${score?.grade || 'A'}`}>
                <p className="mgr-label">Risk score</p>
                <p className="mgr-score-num">{score?.value ?? 0}</p>
                <p className="mgr-score-grade">{score?.grade || 'A'} · {score?.label || 'Clean'}</p>
                <p className="mgr-gate-note">0 clean → 100 critical. Explains risk only — does not override Pass/Fail.</p>
              </div>
            </section>

            <nav className="mgr-toc" aria-label="Report sections">
              <a href="#mgr-summary">01 Summary</a>
              <a href="#mgr-findings">02 Findings</a>
              <a href="#mgr-fixes">03 Fix plan</a>
              {advisory.length ? <a href="#mgr-ai">04 AI signals</a> : null}
              {ignore.length ? <a href="#mgr-ignore">05 Ignore</a> : null}
            </nav>

            <section id="mgr-summary" className="mgr-section">
              <h2><span>01</span> Executive summary</h2>
              <div className="mgr-stats">
                <div className="is-hot"><b>{score?.blocking ?? report.count}</b><span>Blocking</span></div>
                <div className="is-hot"><b>{score?.live ?? 0}</b><span>Likely live</span></div>
                <div><b>{score?.examples ?? 0}</b><span>Sample / fixture</span></div>
                <div><b>{score?.deleted ?? 0}</b><span>Deleted in tree</span></div>
                <div><b>{score?.advisory ?? advisory.length}</b><span>AI advisory</span></div>
              </div>

              {report.muse?.summary ? (
                <div className="mgr-narrative">
                  <div className="mgr-narrative-head">
                    <span className="mgr-narrative-mark" aria-hidden="true">✦</span>
                    <p className="mgr-narrative-label">Muse narrative</p>
                  </div>
                  <p className="mgr-narrative-body">{report.muse.summary}</p>
                </div>
              ) : null}

              {score?.factors?.length ? (
                <div className="mgr-factors">
                  <p className="mgr-label">Score factors</p>
                  <ul>
                    {score.factors.map((factor) => (
                      <li key={factor.key}>
                        <span>{factor.text}</span>
                        <em>{factor.weight > 0 ? `+${factor.weight}` : factor.weight}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section id="mgr-findings" className="mgr-section">
              <div className="mgr-section-head">
                <h2><span>02</span> Findings</h2>
                <p className="mgr-section-hint">Tap ✦ Muse on any row for why it matters and how to fix it.</p>
              </div>
              {blocking.length === 0 ? (
                <p className="mgr-empty">
                  {advisory.length
                    ? 'No blocking secrets. AI authorship signals are listed below and never fail the merge.'
                    : 'Nothing in this scan blocks the merge.'}
                </p>
              ) : (
                <ol className="mgr-findings">
                  {blocking.map((finding, index) => (
                    <FindingCard
                      key={`${finding.source}-${finding.path}-${finding.line}-${finding.rule}-${index}`}
                      finding={finding}
                      index={index}
                      report={report}
                      onOpenMuse={openFindingMuse}
                    />
                  ))}
                </ol>
              )}
            </section>

            <section id="mgr-fixes" className="mgr-section">
              <h2><span>03</span> Fix plan</h2>
              {fixes.length === 0 && rotate.length === 0 ? (
                <p className="mgr-empty">No rotate steps for this scan.</p>
              ) : (
                <ol className="mgr-fixes">
                  {(fixes.length ? fixes : rotate.flatMap((item) => (item.steps || []).map((step) => ({
                    where: item.where || item.rule,
                    text: step,
                    blast: item.blast,
                    why: item.why_live,
                  })))).map((item, index) => (
                    <li key={`${item.where}-${index}`}>
                      <code>{item.where}</code>
                      <p>{item.text}</p>
                      {item.why ? <p className="mgr-finding-meta">{item.why}</p> : null}
                      {item.blast ? <p className="mgr-finding-meta">Blast: {item.blast}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
              {rotate.some((item) => item.fix?.path) ? (
                <div className="mgr-patches">
                  <p className="mgr-label">Suggested patches</p>
                  {rotate.filter((item) => item.fix?.path).slice(0, 4).map((item) => (
                    <pre key={item.fix.path} className="mgr-patch">
{`--- a/${item.fix.path}
+++ b/${item.fix.path}
- ${item.fix.before || ''}
+ ${item.fix.after || ''}`}
                    </pre>
                  ))}
                </div>
              ) : null}
            </section>

            {advisory.length > 0 ? (
              <section id="mgr-ai" className="mgr-section">
                <h2><span>04</span> AI signals · advisory only</h2>
                <p className="mgr-empty">These never block the merge. Evidence for human review.</p>
                {report.muse?.assessment ? (
                  <div className="mgr-narrative">
                    <div className="mgr-narrative-head">
                      <span className="mgr-narrative-mark" aria-hidden="true">✦</span>
                      <p className="mgr-narrative-label">
                        Assessment · {pretty(report.muse.assessment.verdict)}
                        {report.muse.assessment.confidence ? ` · ${report.muse.assessment.confidence} confidence` : ''}
                      </p>
                    </div>
                    {(report.muse.assessment.notes || []).slice(0, 5).map((note) => (
                      <p key={note} className="mgr-narrative-body">{note}</p>
                    ))}
                    {(report.muse.assessment.review_focus || []).slice(0, 5).map((focus) => (
                      <p key={focus} className="mgr-narrative-body">Check: {focus}</p>
                    ))}
                  </div>
                ) : null}
                <ol className="mgr-findings">
                  {advisory.map((finding, index) => (
                    <FindingCard
                      key={`adv-${finding.rule}-${finding.path}-${index}`}
                      finding={finding}
                      index={index}
                      report={report}
                      onOpenMuse={openFindingMuse}
                    />
                  ))}
                </ol>
              </section>
            ) : null}

            {ignore.length > 0 ? (
              <section id="mgr-ignore" className="mgr-section">
                <h2><span>05</span> .sentinelignore candidates</h2>
                <ul className="mgr-ignore">
                  {ignore.slice(0, 10).map((item) => (
                    <li key={item.pattern}>
                      <code>{item.pattern}</code>
                      {item.reason ? <p>{item.reason}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <footer className="mgr-end">
              <p>Rules decide Pass/Fail. Muse explains. Secrets stay masked.</p>
              <p>
                {fromCache
                  ? 'Loaded from this browser’s saved scan — no second GitHub check.'
                  : 'Fresh scan from the hosted API.'}
              </p>
            </footer>
          </article>

          <MuseChat
            report={report}
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            seedQuestion={seedQuestion}
          />
        </div>
      ) : null}

      {activeFinding ? (
        <FindingMuseModal
          report={report}
          finding={activeFinding.finding}
          index={activeFinding.index}
          onClose={() => setActiveFinding(null)}
          onAskMuse={askMuse}
        />
      ) : null}

      {report && !chatOpen ? (
        <button type="button" className="muse-fab" onClick={() => setChatOpen(true)}>
          <span aria-hidden="true">✦</span>
          Muse
        </button>
      ) : null}

      {!busy && !report && !error ? (
        <p className="waiting">Open with <code>?url=</code> for a public GitHub pull request.</p>
      ) : null}
    </div>
  );
}
