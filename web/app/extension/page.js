import Header from '../../components/header';
import Footer from '../../components/footer';

export const metadata = { title: 'Chrome extension · PR Diff Sentinel' };

const STORE_URL = 'https://chromewebstore.google.com/detail/pr-diff-sentinel/ahlihmimlioaieccfbgbpmfabfjhmfch';
/** Chrome Web Store is still under review — not publicly installable yet. */
const STORE_LIVE = false;

export default function ExtensionPage() {
  return (
    <>
      <Header current="extension" />
      <main className="frame">
        <section className="stage stage-extension">
          <div className="copy">
            <p className="kicker">Chrome</p>
            <h1>Scan the pull request already open.</h1>
            <p className="lede">
              Open any public GitHub PR, click Sentinel, and the scan hits the hosted backend automatically — no API URL to paste.
            </p>

            <div className="ext-store">
              {STORE_LIVE ? (
                <>
                  <a className="cta" href={STORE_URL} target="_blank" rel="noreferrer">
                    Add to Chrome
                  </a>
                  <p className="ext-store-note">
                    Live on the Chrome Web Store ·{' '}
                    <a href={STORE_URL} target="_blank" rel="noreferrer">
                      chromewebstore.google.com/…/ahlihmimlioaieccfbgbpmfabfjhmfch
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <p className="ext-store-status">
                    <span className="ext-pill">Pending review</span>
                    Submitted to the Chrome Web Store — not publicly installable yet.
                  </p>
                  <p className="ext-store-note">
                    Store listing (goes live after Google approves):{' '}
                    <a href={STORE_URL} target="_blank" rel="noreferrer">
                      {STORE_URL.replace('https://', '')}
                    </a>
                  </p>
                </>
              )}
            </div>

            <ol className="steps">
              <li>
                <span>01</span>
                <p>
                  {STORE_LIVE
                    ? <>Install from the <a href={STORE_URL} target="_blank" rel="noreferrer">Chrome Web Store</a>, or load unpacked from this repo.</>
                    : <>Until the store approves: open <code>chrome://extensions</code> and turn on Developer mode.</>}
                </p>
              </li>
              <li>
                <span>02</span>
                <p>
                  {STORE_LIVE
                    ? <>Pin Sentinel, open a public GitHub pull request, then click the icon.</>
                    : <>Choose Load unpacked and select the <code>extension</code> folder in this repo.</>}
                </p>
              </li>
              <li>
                <span>03</span>
                <p>
                  {STORE_LIVE
                    ? <>The PR link fills from the tab and scans the live backend automatically.</>
                    : <>Open a public GitHub pull request, then click the Sentinel icon. It fills the link from the tab and scans — no API field.</>}
                </p>
              </li>
            </ol>
          </div>
          <aside className="ext-aside" aria-label="What you get">
            <p className="ext-aside-kicker">Built in</p>
            <ul className="facts compact-facts">
              <li>
                <span>Backend</span>
                <p>Talks to the live Sentinel API. Nothing to configure.</p>
              </li>
              <li>
                <span>Report</span>
                <p>Opens the complete Muse report — risk score, findings, and fix plan.</p>
              </li>
              <li>
                <span>Dashboard</span>
                <p>Local on-device history (ApplySafe-style): fail rate, scores, past scans.</p>
              </li>
            </ul>
          </aside>
        </section>
      </main>
      <Footer />
    </>
  );
}
