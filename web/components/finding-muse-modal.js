'use client';

import { useEffect } from 'react';
import { fixesForFinding, rotateForFinding } from '../lib/finding-detail';
import { githubFindingUrl } from '../lib/github-link';

function pretty(label) {
  return label ? String(label).replaceAll('_', ' ') : 'unlabeled';
}

export default function FindingMuseModal({ report, finding, index, onClose, onAskMuse }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!finding || !report) return null;

  const rotate = rotateForFinding(report, finding);
  const fixes = fixesForFinding(report, finding);
  const fileUrl = githubFindingUrl(report, finding);
  const title = `${String((index ?? 0) + 1).padStart(2, '0')} · ${finding.rule}`;

  return (
    <div className="muse-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="muse-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="muse-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="muse-modal-head">
          <div>
            <p className="muse-chat-kicker">Muse · finding detail</p>
            <h2 id="muse-modal-title">{title}</h2>
          </div>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">Close</button>
        </header>

        <div className="muse-modal-body">
          <div className="muse-modal-badges">
            <span className={`muse-badge sev-${finding.severity || 'medium'}`}>
              {finding.severity || 'medium'}
            </span>
            <span className="muse-badge soft">{pretty(finding.label)}</span>
            {finding.advisory ? <span className="muse-badge soft">advisory · never blocks</span> : (
              <span className="muse-badge soft">blocking</span>
            )}
          </div>

          <dl className="muse-modal-meta">
            <div>
              <dt>Location</dt>
              <dd>{finding.source} · {finding.path}:{finding.line}{finding.removed ? ' · removed' : ''}</dd>
            </div>
            {finding.masked ? (
              <div>
                <dt>Masked value</dt>
                <dd><code>{finding.masked}</code></dd>
              </div>
            ) : null}
            {finding.author || finding.date ? (
              <div>
                <dt>History</dt>
                <dd>{[finding.author, finding.date].filter(Boolean).join(' · ')}</dd>
              </div>
            ) : null}
            {finding.commit ? (
              <div>
                <dt>Commit</dt>
                <dd><code>{String(finding.commit).slice(0, 12)}</code></dd>
              </div>
            ) : null}
          </dl>

          <section>
            <h3>Why it matters</h3>
            <p>{finding.why || rotate?.why_live || 'Rules matched a secret-shaped value in this path.'}</p>
            {rotate?.blast ? <p className="muse-modal-blast">Blast: {rotate.blast}</p> : null}
          </section>

          <section>
            <h3>Fix checklist</h3>
            {fixes.length ? (
              <ol className="muse-modal-steps">
                {fixes.map((step, stepIndex) => (
                  <li key={`${step.text}-${stepIndex}`}>
                    <p>{step.text}</p>
                    {step.why ? <small>{step.why}</small> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <ol className="muse-modal-steps">
                <li><p>Revoke or rotate this credential immediately.</p></li>
                <li><p>Remove it from source and purge git history if it remains in older commits.</p></li>
                <li><p>Load the replacement from a secret manager, then rescan.</p></li>
              </ol>
            )}
          </section>

          {rotate?.fix?.path ? (
            <section>
              <h3>Suggested patch</h3>
              <pre className="mgr-patch">
{`--- a/${rotate.fix.path}
+++ b/${rotate.fix.path}
- ${rotate.fix.before || ''}
+ ${rotate.fix.after || ''}`}
              </pre>
            </section>
          ) : null}
        </div>

        <footer className="muse-modal-foot">
          {fileUrl ? (
            <a className="ghost" href={fileUrl} target="_blank" rel="noreferrer">Open file on GitHub</a>
          ) : null}
          <button
            type="button"
            className="cta"
            onClick={() => onAskMuse?.(`Explain finding ${title} at ${finding.path}:${finding.line} and how to fix it.`)}
          >
            Ask Muse in chat
          </button>
        </footer>
      </div>
    </div>
  );
}
