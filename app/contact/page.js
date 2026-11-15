import Link from 'next/link';

export const metadata = { title: 'Contact · Dealora' };

export default function Page() {
  return (
    <div className="wrap page-pad" style={{ maxWidth: 760 }}>
      <Link className="logo" href="/" style={{ marginBottom: 24, display: 'inline-flex' }}>DEALORA</Link>
      <h1 style={{ fontSize: 36, marginBottom: 16 }}>Contact</h1>
      <p>Questions, removal requests or problems with a deal? Write to us at <b>[your support email here]</b>.</p>
      <p style={{ marginTop: 12 }}>Report a problem: include the store name, the coupon and what went wrong.</p>
    </div>
  );
}
