import Link from 'next/link';
import Header from '../../components/header';
import Footer from '../../components/footer';

export const metadata = { title: 'How it works · PR Diff Sentinel' };

export default function HowPage() {
  return (
    <>
      <Header current="how" />
      <main className="frame">
        <section className="doc-hero">
          <p className="kicker">Design</p>
          <h1>Rules first. Models second.</h1>
          <p className="lede wide">
            The crowded lane is “an LLM reviews your PR.” Sentinel inverts that.
            The merge gate is offline and deterministic. Muse only explains a failure.
          </p>
        </section>

        <section className="doc-block narrow">
          <h2>Scan path</h2>
          <ol className="howto">
            <li>
              <strong>Collect</strong>
              <p>Working tree, three-dot PR diff, and git history (including removed lines and commit messages).</p>
            </li>
            <li>
              <strong>Match</strong>
              <p>Rule engine flags known secret shapes, decoded values, and composite pairs. Output is masked.</p>
            </li>
            <li>
              <strong>Decide</strong>
              <p>Any blocking finding fails the gate. Allowlist can suppress a path or rule. Muse cannot overturn this.</p>
            </li>
            <li>
              <strong>Triage</strong>
              <p>If a Model API key is set, Muse Spark labels each hit. Muse Wonder explains live and unclear ones.</p>
            </li>
          </ol>
        </section>

        <section className="doc-block narrow">
          <h2>What Muse returns</h2>
          <ul className="howto flat">
            <li>
              <strong>Labels</strong>
              <p>likely_live · likely_example · likely_fixture · unclear</p>
            </li>
            <li>
              <strong>Blast radius</strong>
              <p>Which commits, files, and authors share the same masked secret.</p>
            </li>
            <li>
              <strong>Rotate runbook</strong>
              <p>Revoke, contain, prevent — plus a filter-repo purge hint for history hits.</p>
            </li>
            <li>
              <strong>Fix patch</strong>
              <p>Redacted before/after suggestion when the secret is still in a file.</p>
            </li>
            <li>
              <strong>Ignore candidates</strong>
              <p>Only for documentation samples and fixtures.</p>
            </li>
          </ul>
        </section>

        <section className="doc-block narrow">
          <h2>AI authorship signals</h2>
          <p className="doc-lead">
            Separate from secret findings. Public PR metadata can surface advisory signals
            (author, branch, commit trailers). They never fail the merge unless a team turns on strict mode in CI.
          </p>
        </section>

        <section className="doc-block narrow">
          <h2>Hard rules</h2>
          <ul className="rules-list">
            <li>Muse never decides pass/fail.</li>
            <li>Secrets are masked before any model call.</li>
            <li>Contributor-tier model ids are refused.</li>
            <li>Demo works with no API key via a local checklist.</li>
            <li>At most two model calls per scan.</li>
          </ul>
          <p className="doc-cta">
            <Link href="/" className="cta-link">Try a public PR</Link>
            <Link href="/features" className="text-link">See all features</Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
