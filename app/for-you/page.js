'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { CouponCard } from '../../components/Cards';
import { Footer, Header } from '../../components/Shell';
import { inLoc } from '../../lib/regions';

export default function ForYou() {
  const auth = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [picks, setPicks] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!auth.paid) return;
    (async () => {
      const [c, r, p] = await Promise.all([
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('community_members').select('*').eq('kind', 'review'),
        supabase.from('personal_picks').select('*').eq('user_id', auth.user.id).order('month', { ascending: false }).limit(1),
      ]);
      setCoupons(c.data || []); setReviews(r.data || []); setPicks((p.data || [])[0] || null); setLoaded(true);
    })();
  }, [auth.paid, auth.user]);

  if (auth.loading) return <div className="authcard"><p>Loading…</p></div>;
  if (!auth.paid) {
    return (
      <div className="authcard">
        <h1>Your personal page</h1>
        <p>This page is for Verified Users: your own page, updated with the coupons that suit you best and available at all times.</p>
        <Link className="btn btn-solid" href={auth.user ? '/join' : '/signup'}>{auth.user ? 'Become a Verified User' : 'Create free account'}</Link>
      </div>
    );
  }

  const iv = (auth.profile && auth.profile.interests) || {};
  const stores = String(iv.stores || '').toLowerCase().split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const loc = iv.country || '';
  const hasInterests = (iv.categories || []).length || stores.length;
  const score = (d) => {
    let s = 0;
    if ((iv.categories || []).includes(d.category)) s += 2;
    if (stores.some((x) => d.store.toLowerCase().includes(x) || x.includes(d.store.toLowerCase()))) s += 3;
    return s;
  };
  const picked = picks ? picks.coupon_ids.map((id) => coupons.find((c) => c.id === id)).filter(Boolean) : [];
  const pickedIds = new Set(picked.map((d) => d.id));
  const matched = coupons.filter((d) => inLoc(loc, d) && !pickedIds.has(d.id) && score(d) > 0).sort((a, b) => score(b) - score(a)).slice(0, 12);
  const card = (d) => <CouponCard key={d.id} d={d} reviews={reviews} unlocked onReviews={() => {}} />;
  const month = picks ? new Date(picks.month + '-01T00:00:00').toLocaleDateString('en', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="page">
      <Header auth={auth} />
      <main className="wrap page-pad">
        <span className="eyebrow">Verified User</span>
        <h1 style={{ fontSize: 36, margin: '8px 0 6px' }}>Your personal page</h1>
        <p style={{ margin: '4px 0 2px' }}><b>{auth.profile && auth.profile.username ? '@' + auth.profile.username : 'Member'}</b> · {auth.user.email}</p>
        <p style={{ color: 'var(--muted)' }}>Your points: <b>{(auth.profile && auth.profile.points) || 0}</b></p>
        <p style={{ color: 'var(--muted)' }}>The best coupons for you. <Link href="/account" style={{ color: 'var(--brand)', fontWeight: 600 }}>Update my interests</Link></p>

        {picked.length > 0 && (
          <section style={{ paddingBlock: 32 }}>
            <div className="sec-head"><div><h2>Picked for you in {month}</h2>{picks.note && <p>{picks.note}</p>}</div></div>
            <div className="grid">{picked.map(card)}</div>
          </section>
        )}
        <section style={{ paddingBlock: 32 }}>
          <div className="sec-head"><div><h2>Matched to your interests</h2><p>Based on the categories and stores you told us about.</p></div></div>
          {!hasInterests && <p className="empty">Tell us what you use coupons for and we will match deals here. <Link href="/account" style={{ color: 'var(--brand)' }}>Add my interests</Link></p>}
          {loaded && hasInterests && !matched.length && <p className="empty">No matches right now. Check back soon.</p>}
          <div className="grid">{matched.map(card)}</div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
