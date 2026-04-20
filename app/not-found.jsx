import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>This page doesn&apos;t exist.</p>
      <Link href="/" className="landing-btn-primary">
        Back to Home
      </Link>
    </div>
  );
}
