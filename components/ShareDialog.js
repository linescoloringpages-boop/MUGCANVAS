'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cname, sortedCountries } from '../lib/regions';
import { useCategories } from '../lib/useCategories';
import { TERMS_VERSION } from '../lib/termsHtml';

import { compressImage as compress } from '../lib/image';

export default function ShareDialog({ open, onClose, auth, cols, loc, onTerms }) {
  const { names: catNames } = useCategories();
  const [f, setF] = useState({ store: '', description: '', code: '', url: '', category: '', catOther: '', collection: '', other: '', country: 'WW', area: '', terms: false });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [chk, setChk] = useState({ status: '', note: '', url: '', busy: false }); // result of the member's own pre-check

  useEffect(() => { if (open) { setMsg({ type: '', text: '' }); setF((p) => ({ ...p, country: loc || 'WW' })); } }, [open, loc]);
  if (!open) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const urlNow = f.url.trim();
  const passed = chk.status === 'safe' && chk.url === urlNow;
  const checkNow = async () => {
    if (!/^https?:\/\//i.test(urlNow)) return setChk({ status: 'error', note: 'The link must start with http:// or https://', url: urlNow, busy: false });
    setChk({ status: '', note: '', url: urlNow, busy: true });
    try {
      const r = await fetch('/api/check-link', { method: 'POST', headers: { Authorization: 'Bearer ' + auth.session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: urlNow }) });
      const j = await r.json();
      if (!r.ok) return setChk({ status: 'error', note: j.error || 'The check could not run. Please try again.', url: urlNow, busy: false });
      setChk({ status: j.status, note: j.note || '', url: urlNow, busy: false });
    } catch {
      setChk({ status: 'error', note: 'The check could not run. Please try again.', url: urlNow, busy: false });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (!auth.user) return setMsg({ type: 'err', text: 'Please sign in to share a coupon.' });
    const url = f.url.trim();
    if (url && !/^https?:\/\//i.test(url)) return setMsg({ type: 'err', text: 'The link must start with http:// or https://' });
    if (url && !passed) return setMsg({ type: 'err', text: 'Please press “Check link” first. A link can be sent only after it passes the safety check. You can also send the coupon without a link.' });
    if (url && !f.terms) return setMsg({ type: 'err', text: 'Please read and accept the Link Submission Terms to add a link.' });
    if (f.category === '__other' && !f.catOther.trim()) return setMsg({ type: 'err', text: 'Please type a category name, or choose another option.' });
    if (f.collection === '__other' && !f.other.trim()) return setMsg({ type: 'err', text: 'Please type a collection name, or choose another option.' });
    setBusy(true);
    try {
      let image_path = null;
      if (file) {
        const blob = await compress(file);
        image_path = `${auth.user.id}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from('deal-images').upload(image_path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
      }
      const { data: row, error } = await supabase.from('submissions').insert({
        user_id: auth.user.id, kind: 'rec',
        store: f.store.trim(), description: f.description.trim(), code: f.code.trim() || null,
        url: url || null, category: f.category === '__other' ? null : (f.category || catNames[0]), category_other: f.category === '__other' ? f.catOther.trim().slice(0, 30) : null, country: f.country, area: f.area.trim() || null,
        collection_id: f.collection && f.collection !== '__other' ? f.collection : null,
        collection_other: f.collection === '__other' ? f.other.trim().slice(0, 120) : null,
        image_path,
        terms_version: url ? TERMS_VERSION : null, terms_at: url ? new Date().toISOString() : null,
      }).select('id').single();
      if (error) throw error;
      // Automatic safety check of the link (the server reads the link from the database itself).
      let flagged = false;
      if (url && row) {
        try {
          const r = await fetch('/api/check-link', { method: 'POST', headers: { Authorization: 'Bearer ' + auth.session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: row.id }) });
          const j = await r.json();
          flagged = j.status === 'unsafe';
        } catch { /* the Dealora team can run the check again */ }
      }
      setMsg(flagged
        ? { type: 'err', text: 'Your link did not pass our automatic safety check, so this coupon was not accepted. Please check the link and try again with the store’s official page.' }
        : { type: 'ok', text: 'Thank you! Your coupon was sent. Links get an automatic safety check, then the Dealora team approves it before it appears.' });
      setF({ ...f, store: '', description: '', code: '', url: '', other: '', catOther: '', area: '', terms: false });
      setChk({ status: '', note: '', url: '', busy: false });
      setFile(null);
    } catch (err) {
      setMsg({ type: 'err', text: 'Could not submit right now. Please try again.' });
    }
    setBusy(false);
  };

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Share a coupon" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Share a Coupon</h3>
        <p>Your coupon is reviewed by the Dealora team before it appears on the site.</p>
        {!auth.user ? (
          <>
            <p>Sharing is for registered members. Sign up with your email, it is free.</p>
            <div className="dlg-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
              <Link className="btn btn-solid" href="/signup">Join Dealora</Link>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="s-store">Store</label><input id="s-store" required maxLength={60} placeholder="Store name" value={f.store} onChange={set('store')} />
            <label htmlFor="s-desc">What is the deal?</label><input id="s-desc" required maxLength={140} placeholder="e.g. 20% off orders over $50" value={f.description} onChange={set('description')} />
            <label htmlFor="s-code">Coupon code (optional)</label><input id="s-code" maxLength={40} placeholder="CODE" value={f.code} onChange={set('code')} />
            <label htmlFor="s-url">Link to the offer (optional)</label><input id="s-url" type="url" maxLength={300} placeholder="https://" value={f.url} onChange={(e) => { set('url')(e); setChk({ status: '', note: '', url: '', busy: false }); }} />
            {urlNow && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" disabled={chk.busy} onClick={checkNow}>{chk.busy ? 'Checking…' : 'Check link'}</button>
                {chk.url === urlNow && chk.status === 'safe' && <div className="dlg-msg" style={{ marginTop: 8 }}>✓ LINK CHECKED. You can send your coupon.</div>}
                {chk.url === urlNow && chk.status === 'unsafe' && <div className="err" style={{ marginTop: 8 }}>This link did not pass the safety check, so it cannot be sent. Use the store’s official page, or send the coupon without a link.</div>}
                {chk.url === urlNow && chk.status === 'broken' && <div className="err" style={{ marginTop: 8 }}>This link does not seem to work. Please check it, or send the coupon without a link.</div>}
                {chk.url === urlNow && chk.status === 'unverified' && <div className="err" style={{ marginTop: 8 }}>We could not verify this link right now. You can try again later, or send the coupon without a link.{chk.note ? <><br /><small>Reason: {chk.note}</small></> : null}</div>}
                {chk.url === urlNow && chk.status === 'error' && <div className="err" style={{ marginTop: 8 }}>{chk.note}</div>}
              </div>
            )}
            {urlNow && passed && (
              <label className="optin">
                <input type="checkbox" checked={f.terms} onChange={set('terms')} />
                <span>I have read and agree to the <button type="button" className="linkbtn" onClick={onTerms}>Link Submission Terms</button>. Required when you add a link.</span>
              </label>
            )}
            <label htmlFor="s-cat">Category</label>
            <select id="s-cat" value={f.category || catNames[0]} onChange={set('category')}>{catNames.map((c) => <option key={c}>{c}</option>)}<option value="__other">Other…</option></select>
            {f.category === '__other' && <input maxLength={30} placeholder="Suggest a category (up to 30 characters)" aria-label="Other category name" style={{ marginTop: 8 }} value={f.catOther} onChange={set('catOther')} />}
            <label htmlFor="s-col">Collection</label>
            <select id="s-col" value={f.collection} onChange={set('collection')}>
              <option value="">No preference</option>
              {cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__other">Other…</option>
            </select>
            {f.collection === '__other' && <input maxLength={120} placeholder="Name a collection (up to 120 characters)" aria-label="Other collection name" style={{ marginTop: 8 }} value={f.other} onChange={set('other')} />}
            <label htmlFor="s-country">Where does this deal work?</label>
            <select id="s-country" value={f.country} onChange={set('country')}>
              <option value="WW">Worldwide</option>
              {sortedCountries().map((c) => <option key={c} value={c}>{cname(c)}</option>)}
            </select>
            <input maxLength={60} placeholder="Area or city (optional)" aria-label="Area or city" style={{ marginTop: 8 }} value={f.area} onChange={set('area')} />
            <label htmlFor="s-img">Screenshot or photo (optional)</label>
            <input id="s-img" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
            {msg.text && <div className={msg.type === 'ok' ? 'dlg-msg' : 'err'}>{msg.text}</div>}
            <div className="dlg-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
              <button className="btn btn-solid" type="submit" disabled={busy || (!!urlNow && !passed)}>{busy ? 'Sending…' : 'Submit for review'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
