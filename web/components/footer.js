import Link from 'next/link';
import { ME } from '../lib/me';

export default function Footer() {
  return (
    <footer className="site-foot">
      <div className="site-foot-inner">
        <p>
          <b>PR Diff Sentinel</b>
          <span>Rules block the merge. Muse explains. Secrets stay masked.</span>
        </p>
        <nav>
          <Link href="/">Scan</Link>
          <Link href="/testing">Testing</Link>
          <Link href="/features">Features</Link>
          <Link href="/how">How it works</Link>
          <Link href="/extension">Extension</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
      <div className="site-foot-social">
        <span>Built by {ME.name}</span>
        <nav aria-label="Creator social">
          {ME.links.slice(0, 3).map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
