'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { cname } from '../lib/regions';

const PAL = ['#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be123c', '#a21caf', '#0369a1', '#4d7c0f'];
export const colorFor = (n) => { let h = 0; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
export const ini = (n) => String(n).split(/[ &]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
export const stars = (n) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));
// A picture is either a file in the storage bucket or (for sample data) a full data: / https: address.
export const imgUrl = (path) => (!path ? '' : /^(data:|https?:)/.test(path) ? path : supabase.storage.from('deal-images').getPublicUrl(path).data.publicUrl);

export const CAT_ICONS = {
  Fashion: <path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0Z" />,
  Electronics: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  Travel: <path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2l-1.3 1.3 6.4 3.6-3.1 3.1-3-.5L2.5 15l4 1.5L8 20.5l1.5-1.1-.5-3 3.1-3.1 3.6 6.4 1.3-1.3Z" />,
  Food: <path d="M7 2v9M4 2v5a3 3 0 0 0 6 0V2M7 11v11M17 22V2c-2.5 1.5-3.5 5-3.5 8 0 1.5 1 2.5 3.5 2.5" />,
  Home: <path d="m3 11 9-8 9 8M5 10v10h14V10M10 20v-6h4v6" />,
  Beauty: <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-4 3-5 4-8ZM7 21h10" />,
};

// Only verified deals carry a badge. Other deals show none.
export function Badge({ type }) {
  return type === 'verified' ? <span className="badge verified">Verified Deal</span> : null;
}

// Code + link are only present for paid members (the database does not send them to anyone else).
export function Action({ code, url, unlocked, onTrack }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const u = safeUrl(url);
  if (!unlocked) {
    return <Link className="lock" href="/signup">SIGN UP FREE TO UNLOCK</Link>;
  }
  if (!code && u) {
    return <a className="get-link" href={u} target="_blank" rel="noopener noreferrer sponsored" onClick={() => onTrack && onTrack('open')}>GET DEAL</a>;
  }
  if (!open) return <button className="get" onClick={() => { setOpen(true); onTrack && onTrack('reveal'); }}>GET DEAL</button>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied('Copied'); onTrack && onTrack('copy'); } catch { setCopied('Select code'); }
  };
  return (
    <>
      <div className="code" style={{ display: 'flex' }}>
        <span>{code || 'No code needed'}</span>
        {code && <button type="button" onClick={copy}>{copied || 'Copy'}</button>}
      </div>
      {u && <a className="golink" style={{ display: 'flex' }} href={u} target="_blank" rel="noopener noreferrer sponsored" onClick={() => onTrack && onTrack('open')}>Go to store →</a>}
    </>
  );
}

export function CouponCard({ d, reviews, unlocked, onReviews, onTrack }) {
  const rs = reviews.filter((r) => r.coupon_id === d.id && r.rating);
  const avg = rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0;
  const exp = d.expires_on ? 'Ends ' + new Date(d.expires_on + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }) : 'No expiry listed';
  const img = imgUrl(d.image_path);
  return (
    <article className="deal">
      {img && <img className="deal-img" alt="" src={img} loading="lazy" />}
      <div className="deal-top">
        <div className="store"><span className="mono" style={{ background: colorFor(d.store) }}>{ini(d.store)}</span><span>{d.store}</span></div>
        <Badge type={d.type} />
      </div>
      <div className="off">{d.discount_text}</div>
      <p className="desc">{d.description}</p>
      <div className="by">Valid in: {cname(d.country)}{d.area ? ' · ' + d.area : ''}</div>
      <div className="meta"><span>{d.used_text ? d.used_text + ' users saved' : 'New'}</span><span>{exp}</span></div>
      <div className="meta" style={{ border: 0, padding: 0, margin: 0 }}>
        {rs.length > 0 && <span className="stars" aria-hidden="true">{stars(avg)}</span>}
        <button className="linkbtn" onClick={() => onReviews(d)}>{rs.length ? `${rs.length} review${rs.length > 1 ? 's' : ''}` : 'Write a review'}</button>
      </div>
      <Action code={d.code} url={d.url} unlocked={unlocked} onTrack={onTrack && ((k) => onTrack(k, { coupon_id: d.id, store: d.store }))} />
    </article>
  );
}

export function RecCard({ r, unlocked, onTrack }) {
  const img = imgUrl(r.image_path);
  return (
    <article className="deal">
      {img && <img className="deal-img" alt="" src={img} />}
      <div className="deal-top">
        <div className="store"><span className="mono" style={{ background: colorFor(r.store) }}>{ini(r.store)}</span><span>{r.store}</span></div>
      </div>
      <p className="desc" style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.description}</p>
      <div className="by">Valid in: {cname(r.country)}{r.area ? ' · ' + r.area : ''}</div>
      <div className="by">Shared by {r.author_name ? '@' + r.author_name : 'a member'}{r.author_verified && <span className="badge verified" style={{ marginLeft: 6 }}>Verified User</span>}</div>
      <Action code={r.code} url={r.url} unlocked={unlocked} onTrack={onTrack && ((k) => onTrack(k, { store: r.store, detail: 'community' }))} />
    </article>
  );
}

