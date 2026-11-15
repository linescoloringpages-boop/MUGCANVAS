'use client';
import { track } from '../lib/track';
import Board from '../components/Board';
import { useCategories } from '../lib/useCategories';
import { orderStores } from '../lib/storeOrder';
import { imgUrl } from '../components/Cards';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { cname, guessLoc, inLoc, sortedCountries } from '../lib/regions';
import { CAT_ICONS, CouponCard, RecCard, colorFor, ini } from '../components/Cards';
import { Footer, Header, TermsDialog } from '../components/Shell';
import ShareDialog from '../components/ShareDialog';
import ReviewDialog from '../components/ReviewDialog';

const ql_ = (x) => x.trim().toLowerCase();

export default function Home() {
  const auth = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [cols, setCols] = useState([]);
  const [recs, setRecs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [col, setCol] = useState('');
  const [storeRows, setStoreRows] = useState([]);
  const [allStores, setAllStores] = useState(false);
  const { names: catNames } = useCategories();
  const [loc, setLoc] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [rvFor, setRvFor] = useState(null);

  useEffect(() => {
    try { const sv = localStorage.getItem('dealora_loc'); setLoc(sv === null ? guessLoc() : sv); } catch { setLoc(guessLoc()); }
  }, []);
  const changeLoc = (v) => { setLoc(v); try { localStorage.setItem('dealora_loc', v); } catch { /* ignore */ } };

  const member = !!auth.user;
  const uid = auth.user ? auth.user.id : null;
  const [stats, setStats] = useState(null);
  useEffect(() => { supabase.rpc('site_stats').then(({ data }) => { if (data) setStats(data); }); }, []);
  const onTrack = (kind, f) => track(uid, kind, f);
  const load = useCallback(async () => {
    const [c, co, cp, rv, sr] = await Promise.all([
      supabase.from(member ? 'coupons' : 'coupons_public').select('*').order('created_at', { ascending: false }),
      supabase.from('collections').select('*').order('sort'),
      supabase.from(member ? 'community_members' : 'community_public').select('*').eq('kind', 'rec').order('created_at', { ascending: false }),
      supabase.from('community_public').select('*').eq('kind', 'review'),
      supabase.from('stores').select('*'),
    ]);
    setCoupons(c.data || []);
    setCols(co.data || []);
    setRecs(cp.data || []);
    setReviews(rv.data || []);
    setStoreRows(sr.data || []);
    setLoaded(true);
  }, [member]);

  useEffect(() => { if (!auth.loading) load(); }, [auth.loading, load]);

  useEffect(() => {
    if (!uid || ql_(q).length < 2) return;
    const t = setTimeout(() => track(uid, 'search', { detail: ql_(q) }), 1500);
    return () => clearTimeout(t);
  }, [q, uid]);
  useEffect(() => { if (uid && cat) track(uid, 'category', { detail: cat }); }, [cat, uid]);
  useEffect(() => { if (uid && loc) { const t = setTimeout(() => track(uid, 'region', { detail: loc }), 1500); return () => clearTimeout(t); } }, [loc, uid]);

  const live = useMemo(() => coupons.filter((d) => inLoc(loc, d)), [coupons, loc]);
  const ql = q.trim().toLowerCase();
  const okc = (d) => (!cat || d.category === cat) && (!col || (d.collection_ids || []).includes(col)) && (!ql || [d.store, d.description, d.category, d.code, d.discount_text, d.area, cname(d.country)].join(' ').toLowerCase().includes(ql));
  const recsShown = recs.filter((r) => !col && inLoc(loc, r) && (!cat || r.category === cat) && (!ql || [r.store, r.description, r.category].join(' ').toLowerCase().includes(ql)));

  const card = (d) => <CouponCard key={d.id} d={d} reviews={reviews} unlocked={member} onReviews={setRvFor} onTrack={uid ? onTrack : undefined} />;
  const sections = [];
  if (ql || cat || col) {
    const list = live.filter(okc);
    const colTitle = (cols.find((c) => c.id === col) || {}).name;
    sections.push({ id: 'deals', title: colTitle ? colTitle + (cat ? ' · ' + cat : '') : cat ? cat + ' deals' : 'Search results', sub: `${list.length + recsShown.length} found`, cards: [...list.map(card), ...recsShown.map((r) => <RecCard key={r.id} r={r} unlocked={member} onTrack={uid ? onTrack : undefined} />)] });
  } else {
    const used = new Set();
    cols.forEach((c) => {
      const l = live.filter((d) => (d.collection_ids || []).includes(c.id));
      l.forEach((d) => used.add(d.id));
      if (l.length) sections.push({ id: sections.length ? '' : 'deals', title: (c.name === 'Trending Deals' ? '🔥 ' : '') + c.name, cards: l.map(card) });
    });
    const rest = live.filter((d) => !used.has(d.id));
    if (rest.length) sections.push({ id: sections.length ? '' : 'deals', title: 'More deals', cards: rest.map(card) });
    if (recsShown.length) sections.push({ id: sections.length ? '' : 'deals', title: 'Community Picks', sub: 'Shared by members and approved by the Dealora team.', cards: recsShown.map((r) => <RecCard key={r.id} r={r} unlocked={member} onTrack={uid ? onTrack : undefined} />) });
  }

  // only stores that have a live coupon are shown; their order is the automatic one (most coupons first) unless the admin changed it
  const storeList = orderStores(live, storeRows).filter((s) => s.count > 0);
  const stores = allStores ? storeList : storeList.slice(0, 6);

  let status = '';
  if (!loaded) status = 'Loading deals…';
  else if (!live.length && !recsShown.length && !ql && !cat && !col) status = loc ? 'No deals for this region yet. Try “All regions”.' : 'No deals yet. Check back soon.';

  return (
    <div className="page">
      <Header auth={auth} />
      <main className="wrap" id="home">
        <div className="hero">
          <div className="loc"><label htmlFor="loc">Deals for</label>
            <select id="loc" value={loc} onChange={(e) => changeLoc(e.target.value)}>
              <option value="">All regions</option>
              {sortedCountries().map((c) => <option key={c} value={c}>{cname(c)}</option>)}
            </select>
          </div>
          <h1>Find Deals. <span>Save Money.</span></h1>
          <p className="sub">Discover the latest coupons, discounts and deals from your favorite stores — all in one place.</p>
          <form className="sharebar" role="search" onSubmit={(e) => { e.preventDefault(); document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' }); }}>
            <label className="search" htmlFor="q">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input id="q" type="search" placeholder="Search for deals, stores or coupons" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <button type="button" className="share-btn" onClick={() => setShareOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Share a Coupon
            </button>
          </form>
          <small>Search by store, product, deal or coupon code.</small>
          {!auth.loading && !member && (
            <div className="status">Coupon codes and store links are free for members. <Link href="/signup" style={{ color: 'var(--brand)', fontWeight: 600 }}>Sign up with your email</Link> to unlock them.</div>
          )}
          {!auth.loading && member && !auth.paid && (
            <div className="status">Want to be first to know? <Link href="/join" style={{ color: 'var(--brand)', fontWeight: 600 }}>Become a Verified User</Link>: real-time deal emails, a Verified badge and your own page of the best coupons for you.</div>
          )}
          {status && <div className="status">{status}</div>}
        </div>

        <section id="categories" style={{ paddingTop: 16 }}>
          <div className="cats">
            {catNames.map((c) => (
              <button key={c} className="cat" aria-pressed={cat === c} onClick={() => { setCat(cat === c ? '' : c); document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' }); }}>
                <span className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{CAT_ICONS[c] || <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01" />}</svg></span>{c}
              </button>
            ))}
          </div>
          {cols.filter((c) => live.some((d) => (d.collection_ids || []).includes(c.id))).length > 0 && (
            <div className="colchips" aria-label="Collections">
              <span>Collections:</span>
              {cols.filter((c) => live.some((d) => (d.collection_ids || []).includes(c.id))).map((c) => (
                <button key={c.id} className="chip" aria-pressed={col === c.id} onClick={() => { setCol(col === c.id ? '' : c.id); document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' }); }}>{c.name}</button>
              ))}
              {(col || cat) && <button className="chip clear" onClick={() => { setCol(''); setCat(''); }}>Clear filters</button>}
            </div>
          )}
        </section>

        {sections.map((s, i) => (
          <section key={i} id={s.id || undefined}>
            <div className="sec-head"><div><h2>{s.title}</h2>{s.sub && <p>{s.sub}</p>}</div></div>
            <div className="grid">{s.cards.length ? s.cards : <p className="empty">No deals match. Try another search or category.</p>}</div>
          </section>
        ))}

        <section id="board" className="boardrow">
          <Board auth={auth} stats={stats} />
        </section>

        <section>
          <div className="community">
            <div>
              <span className="eyebrow" style={{ color: 'inherit', opacity: 0.75 }}>Community</span>
              <h2 style={{ marginTop: 10 }}>Share. Save. Help Others.</h2>
              <p className="lead">Found a great deal? Share it with the Dealora community and help other shoppers save money.</p>
              <button className="btn" onClick={() => setShareOpen(true)}>SHARE A COUPON</button>
              <p className="by" style={{ marginTop: 14, color: 'inherit', opacity: 0.7 }}>Members only. Every coupon and review is checked by the Dealora team before it appears.</p>
            </div>
            <ul className="feat">
              <li>Upload coupons</li><li>Review deals</li><li>Report expired ones</li><li>Earn points <em style={{ opacity: 0.6, fontStyle: 'normal' }}>(soon)</em></li>
            </ul>
          </div>
        </section>

        <section id="how">
          <div className="sec-head"><div><h2>How It Works</h2><p>Three steps from search to savings.</p></div></div>
          <div className="steps">
            <div className="step"><h3>1. Find a Deal</h3><p>Search Dealora for coupons and discounts.</p></div>
            <div className="step"><h3>2. Get the Deal</h3><p>Click GET DEAL and visit the store.</p></div>
            <div className="step"><h3>3. Save Money</h3><p>Use the coupon or offer and save.</p></div>
          </div>
        </section>

        <section id="stores">
          <div className="sec-head"><div><h2>Popular Stores</h2><p>Stores with deals on Dealora right now.</p></div></div>
          <div className="stores">
            {stores.length ? stores.map((st) => (
              <div className="scard" key={st.key}>
                {st.row && st.row.image_path
                  ? <img className="simg" alt="" src={imgUrl(st.row.image_path)} loading="lazy" />
                  : <span className="mono" style={{ background: colorFor(st.name) }}>{ini(st.name)}</span>}
                <b>{st.name}</b>
                {st.row && st.row.description && <span className="sdesc">{st.row.description}</span>}
                <span>{st.count} deal{st.count > 1 ? 's' : ''}</span>
                <button className="btn" onClick={() => { setQ(st.name); setCat(''); setCol(''); document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' }); }}>View Deals</button>
              </div>
            )) : <p className="empty" style={{ gridColumn: '1/-1' }}>Stores will appear here as deals are added.</p>}
          </div>
          {storeList.length > 6 && <p style={{ textAlign: 'center', marginTop: 14 }}><button className="btn btn-ghost" onClick={() => setAllStores(!allStores)}>{allStores ? 'Show fewer stores' : 'Show all ' + storeList.length + ' stores'}</button></p>}
        </section>

        <section>
          <div className="rewards">
            <div>
              <span className="eyebrow">Rewards</span>
              <h2>Earn Rewards for Sharing</h2>
              <p>Earn points when you contribute useful coupons and help the community confirm what works. Keep it simple: share, help, get rewarded.</p>
              {auth.user && auth.profile && <p><b>Your points: {auth.profile.points || 0}</b> · <Link href="/account" style={{ color: 'var(--brand)', fontWeight: 600 }}>See my points</Link></p>}
              {!auth.user && <p><Link href="/signup" style={{ color: 'var(--brand)', fontWeight: 600 }}>Sign up free to start collecting points</Link></p>}
            </div>
            <div className="earn">
              <div><span className="pts">+ points</span>Share a coupon that others can use</div>
              <div><span className="pts">+ points</span>Write a helpful review</div>
              <div><span className="pts">+ points</span>Flag expired deals so others skip them</div>
              <small>Points are added to your account by the Dealora team. What points can be used for will be announced.</small>
            </div>
          </div>
        </section>
      </main>
      <Footer onTerms={() => setTermsOpen(true)} />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} auth={auth} cols={cols} loc={loc} onTerms={() => setTermsOpen(true)} />
      <ReviewDialog coupon={rvFor} onClose={() => setRvFor(null)} auth={auth} reviews={reviews} />
      <TermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
