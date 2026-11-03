import Link from 'next/link';
import Header from '../../components/header';
import Footer from '../../components/footer';

export const metadata = { title: 'Privacy · PR Diff Sentinel' };

export default function PrivacyPage() {
  return (
    <>
      <Header current="privacy" />
      <main className="frame">
        <section className="doc-hero">
          <p className="kicker">Legal</p>
          <h1>Privacy policy</h1>
          <p className="lede wide">
            How PR Diff Sentinel (website and Chrome extension) handles data when you scan a pull request.
          </p>
        </section>

        <section className="doc-block narrow">
          <h2>What we collect</h2>
          <p>
            When you start a scan, you provide a public GitHub pull request URL. The service fetches
            that public repository content from GitHub to run the secret gate. Scan results show
            masked findings. The Chrome extension does not store personal data; it only reads the
            active tab URL to prefill the scan.
          </p>

          <h2>What we do not collect</h2>
          <p>
            We do not create user accounts in the extension. We do not sell personal data. We do not
            use scan content for advertising or credit decisions.
          </p>

          <h2>Where processing happens</h2>
          <p>
            Scans run on the hosted Sentinel API at{' '}
            <a href="https://pr-diff-sentinel.vercel.app">pr-diff-sentinel.vercel.app</a>. The
            extension calls that backend automatically. Optional Muse triage calls Meta Model API
            only when that backend is configured with a model key; Muse cannot change Pass/Fail.
          </p>

          <h2>Contact</h2>
          <p>
            Questions: open an issue on{' '}
            <a href="https://github.com/umeraamir69/meta-hackathon-2026" target="_blank" rel="noreferrer">
              the project repository
            </a>
            .
          </p>
          <p>
            <Link href="/">Back to scanner</Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
