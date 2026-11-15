import Link from 'next/link';

export const metadata = { title: 'Affiliate Disclosure · Dealora' };

export default function Page() {
  return (
    <div className="wrap page-pad" style={{ maxWidth: 760 }}>
      <Link className="logo" href="/" style={{ marginBottom: 24, display: 'inline-flex' }}>DEALORA</Link>
      <h1 style={{ fontSize: 36, marginBottom: 16 }}>Affiliate Disclosure</h1>
      <p>Dealora may earn a commission when you click a link or use a coupon and then buy from a store. This does not change the price you pay. Commissions help keep the site running.</p>
    </div>
  );
}
