import Header from '../../components/header';

export const metadata = { title: 'Chrome extension · PR Diff Sentinel' };

export default function ExtensionPage() {
  return (
    <>
      <Header current="extension" />
      <main className="frame">
        <section className="stage">
          <div className="copy">
            <p className="kicker">Chrome</p>
            <h1>Scan the pull request already open.</h1>
            <ol className="steps">
              <li>
                <span>01</span>
                <p>Open <code>chrome://extensions</code> and turn on Developer mode.</p>
              </li>
              <li>
                <span>02</span>
                <p>Choose Load unpacked and select the <code>extension</code> folder in this repo.</p>
              </li>
              <li>
                <span>03</span>
                <p>Open a public GitHub pull request, then the Sentinel icon. It fills the link from the tab.</p>
              </li>
              <li>
                <span>04</span>
                <p>After this site is on Vercel, put that URL in the popup’s API field. It is saved in the browser.</p>
              </li>
            </ol>
          </div>
          <figure className="preview">
            <figcaption>Popup</figcaption>
            <div className="preview-card">
              <div className="preview-top">
                <b>Sentinel</b>
                <span>Pass</span>
              </div>
              <div className="preview-field">github.com/owner/repo/pull/123</div>
              <div className="preview-field dim">https://your-app.vercel.app</div>
              <div className="preview-button">Scan</div>
              <div className="preview-row">
                <b>aws_access_key · likely live</b>
                <span>config.env:4 removed</span>
              </div>
            </div>
          </figure>
        </section>
      </main>
    </>
  );
}
