import Link from 'next/link';
import Header from '../components/header';
import Footer from '../components/footer';
import Scanner from '../components/scanner';

const SURFACES = [
  { title: 'Hosted scan', body: 'Public PR, commit, or repo picker.' },
  { title: 'Chrome extension', body: 'Scan the tab already open on GitHub.' },
  { title: 'CLI + Action', body: 'Same gate in local commits and CI.' },
  { title: 'Muse triage', body: 'Labels and rotate notes after a fail.' },
];

export default function HomePage() {
  return (
    <>
      <Header current="scan" />
      <main className="frame">
        <section className="stage stage-scan">
          <div className="copy">
            <p className="kicker">Merge gate</p>
            <h1>The delete did not remove the key.</h1>
            <p className="lede">
              Paste a public pull request for an instant Pass or Fail. Paste a repo to pick PRs and commits. Muse can label a hit. Muse cannot clear the gate.
            </p>
            <ol className="flow">
              <li>
                <span>01</span>
                <p>Paste a GitHub PR or repository link.</p>
              </li>
              <li>
                <span>02</span>
                <p>For a repo, tick up to ten PRs or commits.</p>
              </li>
              <li>
                <span>03</span>
                <p>Read the verdict. Rules decide. Muse only explains.</p>
              </li>
            </ol>
            <ul className="facts compact-facts">
              <li>
                <span>Diff</span>
                <p>The pull request itself is enough to fail the merge.</p>
              </li>
              <li>
                <span>History</span>
                <p>A key deleted in a later commit still counts.</p>
              </li>
              <li>
                <span>Muse</span>
                <p>Labels the hit. The pass or fail stays with the rules.</p>
              </li>
            </ul>
          </div>
          <Scanner autoRun />
        </section>

        <section className="surface-strip" aria-label="Product surfaces">
          <div className="surface-head">
            <h2>More than a web form</h2>
            <Link href="/features">All features</Link>
          </div>
          <div className="surface-grid">
            {SURFACES.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
