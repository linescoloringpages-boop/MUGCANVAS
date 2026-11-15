'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { renderMagazine } from '../lib/magazineEmail';

const DAY = 86400000;
const toItem = (c) => ({ coupon_id: c.id, store: c.store, discount_text: c.discount_text, description: c.description, category: c.category || '', expires_on: c.expires_on || null, image_path: c.image_path || '' });
const fmt = (t) => new Date(t).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });

// Admin tab: build the monthly coupon magazine (up to 100 verified coupons), publish it, and send it.
export default function AdminMagazine({ coupons, members, token, flash }) {
  const [draft, setDraft] = useState(null);
  const [last, setLast] = useState(null); // latest published issue
  const [busy, setBusy] = useState('');
  const [find, setFind] = useState('');
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const { data: d, error } = await supabase.from('magazine_issues').select('*').eq('status', 'draft').maybeSingle();
    if (error) { setErr('Could not load the magazine. Did you run the latest SQL file in Supabase? (' + error.message + ')'); return; }
    const { data: p } = await supabase.from('magazine_issues').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(1).maybeSingle();
    setLast(p || null);
    if (d) { setDraft(d); return; }
    const ins = await supabase.from('magazine_issues').insert({ title: p ? p.title : 'Dealora Monthly', intro: p ? p.intro : '', items: p ? p.items : [] }).select('*').single();
    if (ins.error) setErr('Could not create the draft: ' + ins.error.message); else setDraft(ins.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const items = draft ? draft.items : [];
  const set = (patch) => setDraft({ ...draft, ...patch });
  const setItems = (arr) => set({ items: arr.slice(0, 100) });
  const move = (i, d) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setItems(a); };
  const edit = (i, patch) => setItems(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const remove = (i) => setItems(items.filter((_, k) => k !== i));

  const verified = useMemo(() => coupons.filter((c) => c.type === 'verified' && c.active && (!c.expires_on || c.expires_on >= new Date().toISOString().slice(0, 10))), [coupons]);
  const fill = () => {
    if (items.length && confirm !== 'fill') return setConfirm('fill');
    setConfirm(''); setItems(verified.slice(0, 100).map(toItem)); flash(`Filled with ${Math.min(100, verified.length)} latest verified coupons`);
  };
  const inList = new Set(items.map((x) => x.coupon_id).filter(Boolean));
  const matches = find.trim().length < 2 ? [] : coupons.filter((c) => !inList.has(c.id) && (c.store + ' ' + c.description + ' ' + c.discount_text).toLowerCase().includes(find.trim().toLowerCase())).slice(0, 12);
  const add = (c) => { if (items.length >= 100) return flash('The magazine holds up to 100 coupons.'); setItems([...items, toItem(c)]); setFind(''); };

  const saveDraft = async (quiet) => {
    const { error } = await supabase.from('magazine_issues').update({ title: draft.title || 'Dealora Monthly', intro: draft.intro || '', items: draft.items, updated_at: new Date().toISOString() }).eq('id', draft.id);
    if (error) { flash('Could not save: ' + error.message); return false; }
    if (!quiet) flash('Draft saved'); return true;
  };
  const publish = async () => {
    if (!items.length) return flash('Add coupons first.');
    if (confirm !== 'pub') return setConfirm('pub');
    setConfirm(''); setBusy('pub');
    if (await saveDraft(true)) {
      const { error } = await supabase.from('magazine_issues').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', draft.id);
      flash(error ? 'Could not publish: ' + error.message : 'Published. It is sent to members when their turn comes.');
      if (!error) await load();
    }
    setBusy('');
  };
  const call = async (action) => {
    setBusy(action);
    try {
      if (action === 'test' && !(await saveDraft(true))) { setBusy(''); return; }
      const r = await fetch('/api/magazine/send', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) flash(j.error || 'Could not send.');
      else flash(action === 'test' ? 'Test sent to ' + j.to : `Sent to ${j.sent} member${j.sent === 1 ? '' : 's'}${j.waiting ? ' (' + j.waiting + ' still waiting for the next run)' : ''}.`);
    } catch { flash('Could not reach the server.'); }
    setBusy('');
  };

  const now = Date.now();
  const optedIn = members.filter((m) => m.magazine && m.role !== 'admin');
  const dueNow = optedIn.filter((m) => (m.magazine_last_sent_at ? now - new Date(m.magazine_last_sent_at).getTime() >= 30 * DAY : now - new Date(m.created_at).getTime() >= 2 * DAY)).length;

  if (err) return <p className="empty">{err}</p>;
  if (!draft) return <p className="empty">Loading…</p>;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const html = preview ? renderMagazine({ title: draft.title, intro: draft.intro, items, siteUrl: origin, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, issueDate: new Date() }).html : '';

  return (
    <>
      <p className="hint" style={{ marginBottom: 12 }}>The monthly coupon magazine. Build it here (up to 100 verified coupons), then Publish. The published issue is emailed automatically to members who chose the magazine: first 2 days after they sign up, then every 30 days. Members who did not tick the magazine box never get it.</p>
      <div className="row"><div className="info"><b>Who gets it</b><span>{optedIn.length} member{optedIn.length === 1 ? '' : 's'} chose the magazine · {dueNow} due now · {last ? 'Last published: ' + fmt(last.published_at) : 'Nothing published yet'}</span></div></div>

      <div className="tools"><b>Issue (draft)</b><span className="hint">{items.length} / 100 coupons</span></div>
      <div className="row" style={{ display: 'grid', gap: 10 }}>
        <div><label>Magazine name</label><input className="inline-input" maxLength={80} value={draft.title || ''} onChange={(e) => set({ title: e.target.value })} /></div>
        <div><label>Opening note (optional, shown above the coupons)</label><textarea className="inline-input" rows={3} maxLength={600} value={draft.intro || ''} onChange={(e) => set({ intro: e.target.value })} /></div>
      </div>

      <div className="acts" style={{ marginBottom: 12 }}>
        <button className="sm good" onClick={fill}>{confirm === 'fill' ? 'Replace the list? Click again' : `Fill with the latest ${Math.min(100, verified.length)} verified coupons`}</button>
        <button className="sm" onClick={() => saveDraft(false)}>Save draft</button>
        <button className="sm" onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview'}</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label>Add a coupon (type at least 2 letters of the store or text)</label>
        <input className="inline-input" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search coupons…" />
        {matches.map((c) => (
          <div className="row" key={c.id} style={{ marginTop: 6, marginBottom: 0 }}>
            <div className="info"><b>{c.store} · {c.discount_text}</b><span>{c.description}</span></div>
            <div className="acts"><button className="sm good" onClick={() => add(c)}>Add</button></div>
          </div>
        ))}
      </div>

      {preview && <iframe title="Magazine preview" srcDoc={html} style={{ width: '100%', height: 640, border: '1px solid var(--line)', borderRadius: 14, background: '#fff', marginBottom: 14 }} />}

      {items.length === 0 && <p className="empty">The list is empty. Use “Fill with the latest verified coupons” or add coupons one by one.</p>}
      {items.map((it, i) => (
        <div className="row" key={(it.coupon_id || 'x') + i}>
          <div className="info" style={{ display: 'grid', gap: 6 }}>
            <b>#{i + 1} · {it.store}</b>
            <input className="inline-input" aria-label="Discount" maxLength={30} value={it.discount_text} onChange={(e) => edit(i, { discount_text: e.target.value })} />
            <input className="inline-input" aria-label="Description" maxLength={140} value={it.description} onChange={(e) => edit(i, { description: e.target.value })} />
          </div>
          <div className="acts">
            <button className="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button className="sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button className="sm bad" onClick={() => remove(i)}>Remove</button>
          </div>
        </div>
      ))}

      <div className="tools" style={{ marginTop: 16 }}><b>Publish and send</b></div>
      <div className="acts">
        <button className="sm" disabled={!!busy} onClick={() => call('test')}>{busy === 'test' ? 'Sending…' : 'Send a test to my email'}</button>
        <button className="sm good" disabled={!!busy} onClick={publish}>{confirm === 'pub' ? 'Sure? Click again to publish' : busy === 'pub' ? 'Publishing…' : 'Publish this issue'}</button>
        <button className="sm" disabled={!!busy || !last} onClick={() => call('run')}>{busy === 'run' ? 'Sending…' : 'Send now to members whose turn it is'}</button>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Publishing makes this issue the one that goes out. The site also checks every day by itself and sends it to members whose turn has come. After you publish, a new draft is created from it, so next month you only change what you want.</p>
    </>
  );
}
