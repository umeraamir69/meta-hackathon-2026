import Header from '../../components/header';
import Footer from '../../components/footer';
import TestingLab from '../../components/testing-lab';

export const metadata = { title: 'Testing · PR Diff Sentinel' };

export default function TestingPage() {
  return (
    <>
      <Header current="testing" />
      <main className="frame">
        <section className="doc-hero">
          <p className="kicker">Showcase</p>
          <h1>Test the demo PRs.</h1>
          <p className="lede wide">
            One Fail with real secret hits, two AI, two human, one mixed. AI advisories can fire on a Pass — they never stop the merge. Only blocking secrets Fail.
          </p>
        </section>
        <TestingLab />
      </main>
      <Footer />
    </>
  );
}
