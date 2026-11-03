import Header from '../../components/header';
import Footer from '../../components/footer';
import { ME } from '../../lib/me';

export const metadata = { title: 'About · PR Diff Sentinel' };

export default function AboutPage() {
  return (
    <>
      <Header current="about" />
      <main className="frame">
        <section className="stage stage-about">
          <div className="copy">
            <p className="kicker">About</p>
            <h1>{ME.name}</h1>
            <p className="lede">{ME.blurb}</p>
            <ul className="facts compact-facts">
              <li>
                <span>Now</span>
                <p>{ME.role}</p>
              </li>
              <li>
                <span>Based</span>
                <p>{ME.location}</p>
              </li>
              <li>
                <span>Handle</span>
                <p>@{ME.handle}</p>
              </li>
            </ul>
            <div className="about-social" aria-label="Social links">
              {ME.links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <aside className="about-card">
            <img
              className="about-avatar"
              src={ME.avatar}
              alt=""
              width="96"
              height="96"
            />
            <p className="about-card-name">{ME.name}</p>
            <p className="about-card-role">{ME.role}</p>
            <nav className="about-card-links" aria-label="Profiles">
              {ME.links.slice(0, 3).map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </nav>
          </aside>
        </section>

        <section className="surface-strip" aria-label="Also shipping">
          <div className="surface-head">
            <h2>Also shipping</h2>
          </div>
          <div className="surface-grid">
            {ME.projects.map((item) => (
              <article key={item.title}>
                <h3>
                  <a href={item.href} {...(item.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    {item.title}
                  </a>
                </h3>
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
