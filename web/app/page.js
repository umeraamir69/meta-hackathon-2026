import Header from '../components/header';
import Scanner from '../components/scanner';

export default function HomePage() {
  return (
    <>
      <Header current="scan" />
      <main className="frame">
        <section className="stage">
          <div className="copy">
            <p className="kicker">Merge gate</p>
            <h1>The delete did not remove the key.</h1>
            <p className="lede">
              Paste a public pull request. The gate fails if a secret is in the diff or still in those commits. Muse can name it. Muse cannot pass it.
            </p>
            <ul className="facts">
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
              <li>
                <span>AI signals</span>
                <p>Advisory authorship notes from public PR metadata. Nothing is stored.</p>
              </li>
            </ul>
          </div>
          <Scanner />
        </section>
      </main>
    </>
  );
}
