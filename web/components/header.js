import Link from 'next/link';

export default function Header({ current }) {
  return (
    <header className="top">
      <Link href="/" className="brand">
        <i aria-hidden="true" />
        Sentinel
      </Link>
      <nav>
        <Link href="/" aria-current={current === 'scan' ? 'page' : undefined}>Scan</Link>
        <Link href="/testing" aria-current={current === 'testing' ? 'page' : undefined}>Testing</Link>
        <Link href="/features" aria-current={current === 'features' ? 'page' : undefined}>Features</Link>
        <Link href="/how" aria-current={current === 'how' ? 'page' : undefined}>How</Link>
        <Link href="/extension" aria-current={current === 'extension' ? 'page' : undefined}>Extension</Link>
        <Link href="/about" aria-current={current === 'about' ? 'page' : undefined}>About</Link>
        <Link href="/privacy" aria-current={current === 'privacy' ? 'page' : undefined}>Privacy</Link>
      </nav>
    </header>
  );
}
