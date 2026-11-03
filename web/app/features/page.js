import Link from 'next/link';
import Header from '../../components/header';
import Footer from '../../components/footer';

export const metadata = { title: 'Features · PR Diff Sentinel' };

const GATE = [
  {
    title: 'Working tree',
    body: 'Scans current files for known secret shapes before they ever reach a PR.',
  },
  {
    title: 'PR diff',
    body: 'Three-dot diff scan. A secret introduced on the branch fails the check.',
  },
  {
    title: 'Git history',
    body: 'Deleted keys still count. Removed lines and commit messages are in scope.',
  },
  {
    title: 'Decoded & composite',
    body: 'Base64 and friends, plus id+secret pairs that only look live together.',
  },
  {
    title: 'Allowlist',
    body: '.sentinelignore can quiet a path, a rule, or a rule on a path — never a silent pass.',
  },
  {
    title: 'Fail closed',
    body: 'Shallow clones and git errors fail the gate. fetch-depth: 0 is required in CI.',
  },
];

const MUSE = [
  {
    title: 'Spark labels',
    body: 'likely_live, likely_example, likely_fixture, or unclear — after the gate already failed.',
  },
  {
    title: 'Wonder rotate',
    body: 'why_live, blast radius, revoke runbook, redacted fix patch, filter-repo purge hint.',
  },
  {
    title: 'Ignore candidates',
    body: 'Only for samples and fixtures. Live and unclear hits never get an ignore line.',
  },
  {
    title: 'Never pass/fail',
    body: 'At most two model calls. Contributor models refused. Masked input only.',
  },
];

const SURFACES = [
  { title: 'Hosted scan', body: 'This site. Public repo, PR, or commit → Pass or Fail.', href: '/' },
  { title: 'Chrome extension', body: 'Scan the GitHub tab you already have open.', href: '/extension' },
  { title: 'CLI', body: 'node src/cli.js — exit 1 means the merge should stop.', href: 'https://github.com/umeraamir69/meta-hackathon-2026/tree/main/project' },
  { title: 'GitHub Action', body: 'Fails the check and updates one PR comment.', href: 'https://github.com/umeraamir69/meta-hackathon-2026/blob/main/project/action.yml' },
  { title: 'Pre-commit hook', body: 'Same gate locally. Muse off by default.', href: 'https://github.com/umeraamir69/meta-hackathon-2026/tree/main/project' },
  { title: 'AI signals', body: 'Advisory authorship notes. Never blocks the merge.', href: '/how' },
];

export default function FeaturesPage() {
  return (
    <>
      <Header current="features" />
      <main className="frame">
        <section className="doc-hero">
          <p className="kicker">Product</p>
          <h1>Everything the gate can do.</h1>
          <p className="lede wide">
            Deterministic secret scan across the tree, the PR diff, and git history.
            Muse triages after a failure. Muse cannot clear the check.
          </p>
          <p className="doc-cta">
            <Link href="/" className="cta-link">Open the scanner</Link>
            <Link href="/how" className="text-link">How Muse is used</Link>
          </p>
        </section>

        <section className="doc-block">
          <h2>The gate</h2>
          <p className="doc-lead">No LLM on the critical path. Offline rules decide Pass or Fail.</p>
          <div className="feature-grid">
            {GATE.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="doc-block">
          <h2>Muse triage</h2>
          <p className="doc-lead">At most two calls after a fail: Spark labels, Wonder explains live and unclear hits.</p>
          <div className="feature-grid">
            {MUSE.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="doc-block">
          <h2>Surfaces</h2>
          <p className="doc-lead">Same rules wherever you run them.</p>
          <div className="feature-grid">
            {SURFACES.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {item.href.startsWith('http') ? (
                  <a href={item.href} target="_blank" rel="noreferrer">Open</a>
                ) : (
                  <Link href={item.href}>Open</Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
