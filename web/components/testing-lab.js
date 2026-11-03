'use client';

import { useMemo, useState } from 'react';
import { SHOWCASE } from '../lib/showcase';
import Scanner from './scanner';

export default function TestingLab() {
  const [activeUrl, setActiveUrl] = useState('');
  const active = useMemo(
    () => SHOWCASE.find((item) => item.url === activeUrl) || null,
    [activeUrl],
  );

  return (
    <section className="testing-lab">
      <div className="testing-list" role="list">
        {SHOWCASE.map((item, index) => {
          const on = item.url === activeUrl;
          return (
            <article
              key={item.url}
              className={`testing-card kind-${item.kind}${on ? ' is-active' : ''}`}
              role="listitem"
            >
              <div className="testing-card-top">
                <span className={`testing-kind kind-${item.kind}`}>{item.label}</span>
                <span className="testing-index">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h2>{item.title}</h2>
              <p className="testing-expect"><b>Expect</b> {item.expect}</p>
              <p className="testing-blurb">{item.blurb}</p>
              <div className="testing-card-actions">
                <button
                  type="button"
                  className="cta"
                  onClick={() => setActiveUrl(item.url)}
                >
                  {on ? 'Scanning here' : 'Scan this PR'}
                </button>
                <a href={item.url} target="_blank" rel="noreferrer" className="ghost">
                  Open on GitHub
                </a>
              </div>
            </article>
          );
        })}
      </div>

      <div className="testing-scan">
        <div className="testing-scan-head">
          <p className="ext-aside-kicker">Live scan</p>
          <h2>{active ? active.title : 'Pick a case to test'}</h2>
          <p>
            {active
              ? 'Compact verdict here. Open the full merge gate report for findings, score, and Muse.'
              : 'Start with the Fail case to see blocking secrets, then AI/human for Pass contrast.'}
          </p>
        </div>
        {activeUrl ? (
          <Scanner key={activeUrl} seedUrl={activeUrl} autoRun compact />
        ) : (
          <p className="waiting">Select Fail, AI, human, or mixed above to start a scan.</p>
        )}
      </div>
    </section>
  );
}
