import Link from 'next/link';

export const metadata = { title: 'About · Dealora' };

export default function Page() {
  return (
    <div className="wrap page-pad" style={{ maxWidth: 760 }}>
      <Link className="logo" href="/" style={{ marginBottom: 24, display: 'inline-flex' }}>DEALORA</Link>
      <h1 style={{ fontSize: 36, marginBottom: 16 }}>About</h1>
      <p>Dealora helps shoppers find coupons, discounts and deals from their favorite stores in one place. Members share what works and the Dealora team checks every submission before it appears.</p>
    </div>
  );
}
