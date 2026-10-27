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
        <Link href="/extension" aria-current={current === 'extension' ? 'page' : undefined}>Extension</Link>
      </nav>
    </header>
  );
}
