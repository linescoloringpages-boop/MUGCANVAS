'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { cname, sortedCountries } from '../../lib/regions';
import { useCategories } from '../../lib/useCategories';
import { compressImage } from '../../lib/image';
import { orderStores } from '../../lib/storeOrder';
import AdminStats from '../../components/AdminStats';
import AdminMagazine from '../../components/AdminMagazine';

const imgUrl = (p) => (!p ? '' : /^(data:|https?:)/.test(p) ? p : supabase.storage.from('deal-images').getPublicUrl(p).data.publicUrl);
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
const stars = (n) => '★★★★★'.slice(0, n || 0) + '☆☆☆☆☆'.slice(0, 5 - (n || 0));
const fmt = (t) => new Date(t).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
const CHECK_LABEL = { pending: 'Link check: waiting', safe: 'Link check: CHECKED', unsafe: 'Link check: UNSAFE', broken: 'Link check: link does not work', unverified: 'Link check: could not verify' };
const CHECK_CLASS = { safe: 'pill ok', pending: 'pill', unsafe: 'pill no', broken: 'pill no', unverified: 'pill no' };
const linkOk = (s) => !s.url || (s.link_check === 'safe' && s.link_checked_url === s.url);
const EMPTY = { store: '', discount_text: '', description: '', code: '', url: '', category: '', image_path: '', type: 'verified', used_text: '', expires_on: '', country: 'WW', area: '', collection_ids: [], active: true };

export default function Admin() {
  const auth = useAuth();
  const [tab, setTab] = useState('inbox');
  const [pending, setPending] = useState([]);
  const [published, setPublished] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [cols, setCols] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(null); // coupon being edited
  const [editId, setEditId] = useState(null);
  const [repl, setRepl] = useState({}); // replacement links by submission id
  const [newCol, setNewCol] = useState('');
  const [note, setNote] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [cFilter, setCFilter] = useState(''); // coupons tab country filter
  const [mFilter, setMFilter] = useState(''); // members tab country filter
  const [detail, setDetail] = useState(null); // member whose activity is open
  const [acts, setActs] = useState([]);
  const [staffRows, setStaffRows] = useState([]);
  const [staffEdit, setStaffEdit] = useState(null); // staff_access row being edited
  const [newStaff, setNewStaff] = useState('');
  const [addCountry, setAddCountry] = useState('');
  const [couponCheck, setCouponCheck] = useState('');
  const [busyCheck, setBusyCheck] = useState({});
  const tried = useRef(new Set());
  const [ptsDelta, setPtsDelta] = useState('');
  const [ptsTotal, setPtsTotal] = useState('');
  const [storeRows, setStoreRows] = useState([]);
  const [newStore, setNewStore] = useState({ name: '', description: '', file: null });
  const [ptsReason, setPtsReason] = useState('');
  const [ptsLog, setPtsLog] = useState([]);
  const [picksFor, setPicksFor] = useState(null); // member being edited
  const [pickIds, setPickIds] = useState([]);
  const [pickNote, setPickNote] = useState('');
  const catHook = useCategories();
  const [newCat, setNewCat] = useState('');
  const [couponFile, setCouponFile] = useState(null);
  const [formNewCat, setFormNewCat] = useState('');
  const [formNewCol, setFormNewCol] = useState('');
  const [chatMsgs, setChatMsgs] = useState([]);
  const [removeReason, setRemoveReason] = useState('');
  const [bPosts, setBPosts] = useState([]);
  const [bPending, setBPending] = useState([]);
  const [bForm, setBForm] = useState({ kind: 'announcement', title: '', body: '', replies_open: false, chat_mode: 'moderated', options: '' });

  const load = useCallback(async () => {
    const [p, pub, c, co, m, st] = await Promise.all([
      supabase.from('submissions').select('*, profiles(email,username)').eq('status', 'pending').order('created_at'),
      supabase.from('submissions').select('*, profiles(email,username)').eq('status', 'approved').order('reviewed_at', { ascending: false }),
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('collections').select('*').order('sort'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('staff_access').select('*'),
    ]);
    if (auth.admin) {
      const [bp, bc, cm] = await Promise.all([
        supabase.from('board_posts').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(60),
        supabase.from('board_comments').select('*, profiles(username,email,board_restricted)').eq('status', 'pending').order('created_at'),
        supabase.from('board_comments').select('*, profiles(username,email,board_restricted)').eq('status', 'approved').order('created_at', { ascending: false }).limit(40),
      ]);
      setBPosts(bp.data || []); setBPending(bc.data || []); setChatMsgs(cm.data || []);
    }
    setPending(p.data || []); setPublished(pub.data || []); setCoupons(c.data || []); setCols(co.data || []); setMembers(m.data || []); setStaffRows(st.data || []);
    const sr = await supabase.from('stores').select('*'); setStoreRows(sr.data || []);
  }, [auth.admin]);
  const allowed = auth.admin || auth.staff;
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const token = auth.session ? auth.session.access_token : '';
  const callCheck = useCallback(async (body) => {
    const r = await fetch('/api/check-link', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }, [token]);
  const runCheck = useCallback(async (id) => {
    setBusyCheck((b) => ({ ...b, [id]: true }));
    try { await callCheck({ submissionId: id }); } catch { /* shown as still waiting */ }
    setBusyCheck((b) => ({ ...b, [id]: false }));
    await load();
  }, [callCheck, load]);
  // Links waiting for their automatic check are checked as soon as the admin opens the page.
  useEffect(() => {
    if (!allowed) return;
    [...pending, ...published].filter((x) => x.url && x.link_check === 'pending' && !tried.current.has(x.id)).slice(0, 5).forEach((x) => { tried.current.add(x.id); runCheck(x.id); });
  }, [allowed, pending, published, runCheck]);

  if (auth.loading) return <div className="authcard"><p>Loading…</p></div>;
  if (!allowed) return <div className="authcard"><h1>Admin</h1><p>This area is for the Dealora team.</p><Link className="btn btn-solid" href="/login">Sign in</Link></div>;

  // The main admin can do everything. A staff admin can do only what the main admin ticked, only in the chosen countries.
  // (The database enforces this too; hiding buttons here is only for convenience.)
  const owner = !!auth.admin;
  const acc = auth.access || { countries: [] };
  const inScope = (c) => owner || acc.countries.includes('*') || acc.countries.includes(c || 'WW');
  const can = (perm) => owner || !!acc['perm_' + perm];
  const myCoupons = coupons.filter((c) => inScope(c.country));
  const allCountries = ['WW', ...sortedCountries()];
  const formCountries = owner || acc.countries.includes('*') ? allCountries : allCountries.filter((c) => acc.countries.includes(c));
  const cLabel = (c) => (c === '*' ? 'All countries' : cname(c));
  const colName = (id) => (cols.find((c) => c.id === id) || {}).name;
  const memberState = (uid) => { const m = members.find((x) => x.id === uid); return m ? (m.paid || m.role === 'admin' ? 'paid' : 'free') : 'free'; };
  const flash = (t) => { setNote(t); setTimeout(() => setNote(''), 2500); };

  const approve = async (s) => {
    const upd = { status: 'approved', reviewed_at: new Date().toISOString() };
    const r = (repl[s.id] || '').trim();
    if (s.kind === 'rec' && r) {
      if (!safeUrl(r)) return flash('Replacement link must start with http:// or https://');
      // Your own link also goes through the automatic check before anything is published.
      const first = await supabase.from('submissions').update({ original_url: s.url || null, url: r, terms_version: s.terms_version || 'admin', terms_at: s.terms_at || new Date().toISOString() }).eq('id', s.id);
      if (first.error) return flash('Could not save the link: ' + first.error.message);
      const res = await callCheck({ submissionId: s.id });
      if (res.status !== 'safe') { await load(); return flash('Your replacement link did not pass the check: ' + (res.note || res.status)); }
    } else if (!linkOk(s)) {
      return flash('This link has not passed the automatic check yet.');
    }
    const { error } = await supabase.from('submissions').update(upd).eq('id', s.id);
    if (error) return flash('Could not approve: ' + error.message);
    await load();
  };
  const addBoardPost = async (e) => {
    e.preventDefault();
    const f = bForm; const title = f.title.trim();
    if (!title) return flash('Please write a title.');
    const chat = f.kind === 'question' || f.replies_open;
    const row = { kind: f.kind, title, body: f.body.trim(), replies_open: chat, chat_mode: chat ? f.chat_mode : 'moderated', status: 'published' };
    if (f.kind === 'poll') {
      const opts = f.options.split('\n').map((x) => x.trim()).filter(Boolean);
      if (opts.length < 2 || opts.length > 6) return flash('A poll needs 2 to 6 options, one per line.');
      row.poll_options = opts;
    }
    const { error } = await supabase.from('board_posts').insert(row);
    if (error) return flash('Could not post: ' + error.message);
    setBForm({ kind: 'announcement', title: '', body: '', replies_open: false, chat_mode: 'moderated', options: '' }); flash('Posted on the board'); await load();
  };
  const onBoard = new Set(); bPosts.forEach((p) => { if (p.coupon_id && p.kind === 'coupon') onBoard.add('c' + p.coupon_id); if (p.submission_id) onBoard.add('s' + p.submission_id); });
  const queueCoupons = coupons.filter((c) => c.active && !onBoard.has('c' + c.id)).slice(0, 30);
  const queueSubs = published.filter((x) => !onBoard.has('s' + x.id)).slice(0, 40);
  const addToBoard = async (row) => { const { error } = await supabase.from('board_posts').insert({ status: 'published', ...row }); flash(error ? 'Could not post: ' + error.message : row.status === 'hidden' ? 'Skipped' : 'Shown on the board'); await load(); };
  const showCoupon = (c, status) => addToBoard({ kind: 'coupon', title: c.store, store: c.store, coupon_id: c.id, ...(status ? { status } : {}) });
  const showSub = (x, status) => addToBoard({ kind: x.kind === 'rec' ? 'rec' : 'review', title: x.store, store: x.store, submission_id: x.id, ...(status ? { status } : {}) });
  const delSub = async (x) => { if (confirmId !== x.id) return setConfirmId(x.id); const { error } = await supabase.from('submissions').delete().eq('id', x.id); setConfirmId(null); flash(error ? 'Could not delete: ' + error.message : 'Deleted'); await load(); };
  const setRestricted = async (id, on) => { const { error } = await supabase.from('profiles').update({ board_restricted: on }).eq('id', id); flash(error ? 'Could not save: ' + error.message : on ? 'This member’s chat messages now wait for your approval' : 'This member can chat freely again'); await load(); };
  const removeMember = async (m) => {
    if (confirmId !== 'rm' + m.id) return setConfirmId('rm' + m.id);
    try {
      const r = await fetch('/api/remove-member', { method: 'POST', headers: { Authorization: 'Bearer ' + auth.session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: m.id, reason: removeReason }) });
      const j = await r.json();
      flash(r.ok ? 'Membership removed' : (j.error || 'Could not remove the member'));
      if (r.ok) { setDetail(null); setRemoveReason(''); }
    } catch { flash('Could not reach the server.'); }
    setConfirmId(null); await load();
  };
  const sList = orderStores(coupons, storeRows);
  const storeManual = storeRows.some((r) => r.sort != null);
  const uploadPic = async (file) => {
    const blob = await compressImage(file);
    const path = `${auth.user.id}/s-${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from('deal-images').upload(path, blob, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    return path;
  };
  const addStoreFn = async (e) => {
    e.preventDefault();
    const name = newStore.name.trim().slice(0, 60); if (!name) return flash('Please type the store name.');
    let image_path = null;
    try { if (newStore.file) image_path = await uploadPic(newStore.file); } catch { return flash('Could not upload the picture. Try a smaller image.'); }
    const ex = sList.find((x) => x.key === name.toLowerCase());
    const row = { name, description: newStore.description.trim().slice(0, 300) || null, image_path };
    const q = ex && ex.row ? supabase.from('stores').update({ description: row.description, ...(image_path ? { image_path } : {}) }).eq('id', ex.row.id) : supabase.from('stores').insert(row);
    const { error } = await q;
    if (error) return flash('Could not save the store: ' + error.message);
    setNewStore({ name: '', description: '', file: null }); flash('Store saved. It shows on the home page once it has at least one coupon.'); await load();
  };
  const saveStore = async (st, patch) => {
    const q = st.row ? supabase.from('stores').update(patch).eq('id', st.row.id) : supabase.from('stores').insert({ name: st.name, ...patch });
    const { error } = await q; if (error) flash('Could not save: ' + error.message); else flash('Saved');
    await load();
  };
  const storePic = async (st, file) => { if (!file) return; try { await saveStore(st, { image_path: await uploadPic(file) }); } catch { flash('Could not upload the picture. Try a smaller image.'); } };
  const renameStore = async (st, name) => {
    const nm = name.trim().slice(0, 60); if (!nm || nm === st.name) return;
    const q = st.row ? supabase.from('stores').update({ name: nm }).eq('id', st.row.id) : supabase.from('stores').insert({ name: nm });
    const { error } = await q; if (error) return flash('Could not rename: ' + error.message);
    await supabase.from('coupons').update({ store: nm }).eq('store', st.name);
    await supabase.from('submissions').update({ store: nm }).eq('store', st.name);
    flash('Renamed. All its coupons were updated.'); await load();
  };
  const moveStore = async (i, d) => {
    const a = sList.slice(); const j = i + d; if (j < 0 || j >= a.length) return;
    a.splice(j, 0, a.splice(i, 1)[0]);
    const res = await Promise.all(a.map((st, k) => {
      if (st.row) return st.row.sort === k + 1 ? null : supabase.from('stores').update({ sort: k + 1 }).eq('id', st.row.id);
      return supabase.from('stores').insert({ name: st.name, sort: k + 1 });
    }));
    const bad = res.find((r) => r && r.error); if (bad) flash('Could not save the order: ' + bad.error.message);
    await load();
  };
  const resetStoreOrder = async () => {
    const { error } = await supabase.from('stores').update({ sort: null }).not('sort', 'is', null);
    flash(error ? 'Could not reset: ' + error.message : 'Back to the automatic order: the store with the most coupons comes first.'); await load();
  };
  const delStore = async (st) => { if (confirmId !== 's' + st.key) return setConfirmId('s' + st.key); const { error } = await supabase.from('stores').delete().eq('id', st.row.id); setConfirmId(null); flash(error ? 'Could not delete: ' + error.message : 'Store page details deleted (its coupons stay)'); await load(); };
  const boardUpd = async (p, patch) => { const { error } = await supabase.from('board_posts').update(patch).eq('id', p.id); if (error) flash(error.message); await load(); };
  const boardDel = async (p) => { if (confirmId !== p.id) return setConfirmId(p.id); await supabase.from('board_posts').delete().eq('id', p.id); setConfirmId(null); await load(); };
  const replyDecide = async (c, status) => { const { error } = await supabase.from('board_comments').update({ status }).eq('id', c.id); if (error) flash(error.message); await load(); };
  const announceMember = async (m) => {
    if (!m.username) return flash('This member has no username yet.');
    const { error } = await supabase.from('board_posts').insert({ kind: 'member', title: 'Welcome @' + m.username + '!', body: 'A new member joined the Dealora community.', status: 'published' });
    flash(error ? 'Could not post: ' + error.message : 'Welcome post added to the board');
    await load();
  };
  const reject = async (s) => { await supabase.from('submissions').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', s.id); await load(); };
  const saveLink = async (s, val) => {
    const v = (val || '').trim();
    if (v && !safeUrl(v)) return flash('Link must start with http:// or https://');
    const upd = { url: v || null };
    if (v) { upd.terms_version = s.terms_version || 'admin'; upd.terms_at = s.terms_at || new Date().toISOString(); upd.original_url = s.original_url || s.url || null; }
    const { error } = await supabase.from('submissions').update(upd).eq('id', s.id);
    flash(error ? 'Could not save: ' + error.message : 'Saved. Checking the new link…');
    if (!error && v) { tried.current.add(s.id); await runCheck(s.id); } else await load();
  };

  const openCoupon = (c) => { setEditId(c ? c.id : null); setCouponFile(null); setFormNewCat(''); setFormNewCol('');
    setForm(c ? { ...EMPTY, ...c, image_path: c.image_path || '', code: c.code || '', url: c.url || '', used_text: c.used_text || '', expires_on: c.expires_on || '', area: c.area || '' } : { ...EMPTY }); };
  const saveCoupon = async (e) => {
    e.preventDefault();
    if (form.url && !safeUrl(form.url)) return flash('Link must start with http:// or https://');
    let category = form.category || catHook.names[0];
    if (category === '__new') {
      const nm = formNewCat.trim().slice(0, 30);
      if (!nm) return flash('Please type the new category name.');
      const ex = catHook.rows.find((r) => r.name.toLowerCase() === nm.toLowerCase());
      if (ex) category = ex.name;
      else {
        const ins = await supabase.from('categories').insert({ name: nm, sort: catHook.rows.length + 1 });
        if (ins.error) return flash('Could not add the category: ' + ins.error.message);
        category = nm;
      }
    }
    let collection_ids = form.collection_ids;
    const nc = formNewCol.trim().slice(0, 60);
    if (nc) {
      const ex = cols.find((c) => c.name.toLowerCase() === nc.toLowerCase());
      if (ex) { if (!collection_ids.includes(ex.id)) collection_ids = [...collection_ids, ex.id]; }
      else {
        const ins = await supabase.from('collections').insert({ name: nc, sort: cols.length + 1 }).select('id').single();
        if (ins.error) return flash('Could not add the collection: ' + ins.error.message);
        collection_ids = [...collection_ids, ins.data.id];
      }
    }
    let image_path = form.image_path || null;
    if (couponFile) {
      try {
        const blob = await compressImage(couponFile);
        const path = `${auth.user.id}/c-${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from('deal-images').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        image_path = path;
      } catch { return flash('Could not upload the picture. Try a smaller image.'); }
    }
    const row = {
      store: form.store.trim(), discount_text: form.discount_text.trim(), description: form.description.trim(),
      code: form.code.trim() || null, url: form.url.trim() || null, category, type: form.type,
      used_text: form.used_text.trim() || null, expires_on: form.expires_on || null, country: form.country || 'WW',
      area: form.area.trim() || null, collection_ids, image_path, active: form.active,
    };
    const q = editId ? supabase.from('coupons').update(row).eq('id', editId) : supabase.from('coupons').insert(row);
    const { error } = await q;
    if (error) return flash('Could not save: ' + error.message);
    setForm(null); setCouponFile(null); await catHook.reload(); await load();
  };
  const delCoupon = async (c) => { if (confirmId !== c.id) return setConfirmId(c.id); await supabase.from('coupons').delete().eq('id', c.id); setConfirmId(null); await load(); };
  const toggleActive = async (c) => { await supabase.from('coupons').update({ active: !c.active }).eq('id', c.id); await load(); };

  const addCol = async (e) => {
    e.preventDefault();
    const nm = newCol.trim(); if (!nm) return;
    const { error } = await supabase.from('collections').insert({ name: nm.slice(0, 60), sort: cols.length + 1 });
    if (error) return flash('Could not add the collection: ' + error.message);
    setNewCol(''); flash('Collection added. It shows on the home page once it has at least one coupon.'); await load();
  };
  const renameCol = async (c, name) => {
    if (!name.trim() || name === c.name) return;
    const { error } = await supabase.from('collections').update({ name: name.trim() }).eq('id', c.id);
    if (error) flash('Could not rename: ' + error.message);
    await load();
  };
  const addCat = async (e) => {
    e.preventDefault();
    const nm = newCat.trim().slice(0, 30); if (!nm) return;
    const { error } = await supabase.from('categories').insert({ name: nm, sort: catHook.rows.length + 1 });
    if (error) return flash(/duplicate|unique/i.test(error.message) ? 'That category already exists.' : 'Could not add the category: ' + error.message);
    setNewCat(''); flash('Category added'); await catHook.reload();
  };
  const renameCat = async (r, name) => {
    const nm = name.trim().slice(0, 30);
    if (!nm || nm === r.name) return;
    const { error } = await supabase.from('categories').update({ name: nm }).eq('id', r.id);
    if (error) return flash('Could not rename: ' + error.message);
    await supabase.from('coupons').update({ category: nm }).eq('category', r.name);
    await supabase.from('submissions').update({ category: nm }).eq('category', r.name);
    await catHook.reload(); await load();
  };
  const moveCat = async (i, d) => {
    const a = catHook.rows.slice(); const j = i + d; if (j < 0 || j >= a.length) return;
    a.splice(j, 0, a.splice(i, 1)[0]);
    await Promise.all(a.map((c, k) => (c.sort !== k + 1 ? supabase.from('categories').update({ sort: k + 1 }).eq('id', c.id) : null)));
    await catHook.reload();
  };
  const delCat = async (r) => {
    const used = coupons.filter((c) => c.category === r.name).length;
    if (used) return flash(used + ' coupon(s) use this category. Move them to another category first.');
    if (confirmId !== r.id) return setConfirmId(r.id);
    const { error } = await supabase.from('categories').delete().eq('id', r.id);
    setConfirmId(null); flash(error ? 'Could not delete: ' + error.message : 'Category deleted'); await catHook.reload();
  };
  const acceptCategory = async (s) => {
    const nm = (s.category_other || '').trim().slice(0, 30); if (!nm) return;
    let name = nm;
    const ex = catHook.rows.find((r) => r.name.toLowerCase() === nm.toLowerCase());
    if (ex) name = ex.name;
    else { const ins = await supabase.from('categories').insert({ name: nm, sort: catHook.rows.length + 1 }); if (ins.error) return flash('Could not add the category: ' + ins.error.message); }
    await supabase.from('submissions').update({ category: name, category_other: null }).eq('id', s.id);
    flash('Category “' + name + '” added to the site'); await catHook.reload(); await load();
  };
  const acceptCollection = async (s) => {
    const nm = (s.collection_other || '').trim().slice(0, 60); if (!nm) return;
    let id = (cols.find((c) => c.name.toLowerCase() === nm.toLowerCase()) || {}).id;
    if (!id) { const ins = await supabase.from('collections').insert({ name: nm, sort: cols.length + 1 }).select('id').single(); if (ins.error) return flash('Could not add the collection: ' + ins.error.message); id = ins.data.id; }
    await supabase.from('submissions').update({ collection_id: id, collection_other: null }).eq('id', s.id);
    flash('Collection “' + nm + '” added to the site'); await load();
  };
  const moveCol = async (i, d) => {
    const a = cols.slice(); const j = i + d; if (j < 0 || j >= a.length) return;
    a.splice(j, 0, a.splice(i, 1)[0]);
    await Promise.all(a.map((c, k) => (c.sort !== k + 1 ? supabase.from('collections').update({ sort: k + 1 }).eq('id', c.id) : null)));
    await load();
  };
  const delCol = async (c) => { if (confirmId !== c.id) return setConfirmId(c.id); const { error } = await supabase.from('collections').delete().eq('id', c.id); setConfirmId(null); if (error) flash('Could not delete: ' + error.message); await load(); };

  const isPaid = (m) => m.paid || m.role === 'admin';
  const couponCountries = [...new Set(myCoupons.map((c) => c.country || 'WW'))].sort((a, b) => (a === 'WW' ? -1 : b === 'WW' ? 1 : cname(a).localeCompare(cname(b))));
  const memberCountries = [...new Set(members.map((m) => m.country || ''))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : cname(a).localeCompare(cname(b))));
  const inM = (m) => !mFilter || (mFilter === '_none' ? !m.country : m.country === mFilter);
  const lists = {
    realtime: members.filter((m) => inM(m) && isPaid(m) && !m.realtime_off).map((m) => m.email),
    marketing: members.filter((m) => inM(m) && m.marketing).map((m) => m.email),
    magazine: members.filter((m) => inM(m) && m.magazine).map((m) => m.email),
  };
  const openDetail = async (m) => {
    setDetail(m); setActs([]); setPtsLog([]); setPtsDelta(''); setPtsReason('');
    const [a, pl] = await Promise.all([
      supabase.from('member_activity').select('*').eq('user_id', m.id).order('created_at', { ascending: false }).limit(500),
      supabase.from('points_log').select('*').eq('user_id', m.id).order('created_at', { ascending: false }).limit(30),
    ]);
    setActs(a.data || []); setPtsLog(pl.data || []);
  };
  const addPoints = async () => {
    const n = parseInt(ptsDelta, 10);
    if (!n || Math.abs(n) > 100000) return flash('Type a whole number of points, for example 25 or -10.');
    const { error } = await supabase.from('points_log').insert({ user_id: detail.id, delta: n, reason: ptsReason.trim().slice(0, 200) || null });
    if (error) return flash(/points_check/.test(error.message) ? 'A balance cannot go below zero.' : 'Could not save: ' + error.message);
    flash((n > 0 ? '+' : '') + n + ' points saved');
    await load();
    await openDetail({ ...detail, points: (detail.points || 0) + n });
  };
  const setTotal = async () => {
    const target = parseInt(ptsTotal, 10);
    if (Number.isNaN(target) || target < 0 || target > 1000000) return flash('Type the total you want, for example 40.');
    const n = target - (detail.points || 0);
    if (n === 0) return flash('The total is already ' + target + '.');
    const { error } = await supabase.from('points_log').insert({ user_id: detail.id, delta: n, reason: (ptsReason.trim() || 'Total set by admin').slice(0, 200) });
    if (error) return flash('Could not save: ' + error.message);
    flash('Total set to ' + target); setPtsTotal('');
    await load();
    await openDetail({ ...detail, points: target });
  };
  const tally = (rows, key) => { const t = {}; rows.forEach((r) => { const k = key(r); if (k) t[k] = (t[k] || 0) + 1; }); return Object.entries(t).sort((a, b) => b[1] - a[1]); };
  const summary = (m, rows) => {
    const i = m.interests || {};
    const lines = [
      `Member: ${m.email}${m.username ? ' (@' + m.username + ')' : ''}`, `Points: ${m.points || 0}`, `Status: ${isPaid(m) ? 'Verified' : 'Free'}`, `Country: ${m.country ? cname(m.country) : 'not set'}`,
      `Marketing: ${m.marketing ? 'yes' : 'no'} | Magazine: ${m.magazine ? 'yes' : 'no'}`,
      `Interests: ${ivText(m)}`,
      `Searches: ${tally(rows.filter((r) => r.kind === 'search'), (r) => r.detail).map(([k, n]) => k + (n > 1 ? ' x' + n : '')).join('; ') || 'none'}`,
      `Categories browsed: ${tally(rows.filter((r) => r.kind === 'category'), (r) => r.detail).map(([k, n]) => k + ' x' + n).join('; ') || 'none'}`,
      `Coupons used (revealed/copied/opened): ${tally(rows.filter((r) => ['reveal', 'copy', 'open'].includes(r.kind)), (r) => r.store).map(([k, n]) => k + ' x' + n).join('; ') || 'none'}`,
    ];
    return lines.join('\n');
  };
  const copySummary = async () => { try { await navigator.clipboard.writeText(summary(detail, acts)); flash('Summary copied'); } catch { flash('Could not copy'); } };
  const copyList = async (k) => { try { await navigator.clipboard.writeText(lists[k].join(', ')); flash('Copied'); } catch { flash('Select the text and copy it'); } };
  const setPaid = async (m, paid) => {
    const { error } = await supabase.from('profiles').update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq('id', m.id);
    flash(error ? error.message : 'Saved'); await load();
  };
  const month = new Date().toISOString().slice(0, 7);
  const openPicks = async (m) => {
    const { data } = await supabase.from('personal_picks').select('*').eq('user_id', m.id).eq('month', month).maybeSingle();
    setPicksFor(m); setPickIds(data ? data.coupon_ids : []); setPickNote(data ? data.note || '' : '');
  };
  const savePicks = async () => {
    const { error } = await supabase.from('personal_picks').upsert({ user_id: picksFor.id, month, coupon_ids: pickIds, note: pickNote.slice(0, 500) }, { onConflict: 'user_id,month' });
    flash(error ? error.message : 'Personal page saved'); if (!error) setPicksFor(null);
  };
  const togglePick = (id) => setPickIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const ivText = (m) => { const i = m.interests || {}; const bits = [(i.categories || []).join(', '), i.stores, (i.saveFor || []).join(', '), i.country].filter(Boolean); return bits.length ? bits.join(' · ') : 'No answers yet'; };

  const LinkBadge = ({ s }) => (s.url ? (
    <span>
      <span className={CHECK_CLASS[s.link_check] || 'pill'}>{busyCheck[s.id] ? 'Link check: running…' : (CHECK_LABEL[s.link_check] || 'Link check: waiting')}</span>
      {s.link_check_note ? ' ' + s.link_check_note : ''}{' '}
      <button className="sm" disabled={!!busyCheck[s.id]} onClick={() => runCheck(s.id)}>{s.link_check === 'pending' ? 'Run check' : 'Check again'}</button>
    </span>
  ) : null);
  const checkCouponLink = async () => {
    if (!form.url.trim()) return setCouponCheck('Add a link first.');
    if (!safeUrl(form.url.trim())) return setCouponCheck('Link must start with http:// or https://');
    setCouponCheck('Checking…');
    try { const j = await callCheck({ url: form.url.trim() }); setCouponCheck((CHECK_LABEL[j.status] || 'Link check') + (j.note ? ': ' + j.note : '')); } catch { setCouponCheck('Could not run the check.'); }
  };

  const PERMS = [["perm_coupons", "Add and edit coupons"], ["perm_delete_coupons", "Delete coupons (only in their countries)"], ["perm_collections", "Manage collections (applies to all countries)"], ["perm_stores", "Manage stores: add, edit, picture, text and order (applies to all countries)"], ["perm_approve", "Approve or reject member submissions"], ["perm_links", "Replace links that members sent"], ["perm_members", "See members, their activity and email lists"], ["perm_points", "Add points (needs \"See members\")"], ["perm_picks", "Prepare personal pages (needs \"See members\")"]];
  const staffMembers = members.filter((m) => m.role === 'staff');
  const accessOf = (id) => staffRows.find((r) => r.user_id === id) || { user_id: id, countries: [] };
  const addStaff = async () => {
    if (!newStaff) return;
    const a = await supabase.from('profiles').update({ role: 'staff' }).eq('id', newStaff);
    if (a.error) return flash('Could not save: ' + a.error.message);
    const b = await supabase.from('staff_access').upsert({ user_id: newStaff, countries: [] }, { onConflict: 'user_id' });
    if (b.error) return flash('Could not save: ' + b.error.message);
    const id = newStaff; setNewStaff(''); await load(); setStaffEdit({ user_id: id, countries: [] }); flash('Now choose their countries and permissions, then save.');
  };
  const saveStaff = async () => {
    const row = { ...staffEdit, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('staff_access').upsert(row, { onConflict: 'user_id' });
    flash(error ? 'Could not save: ' + error.message : 'Saved'); if (!error) { setStaffEdit(null); await load(); }
  };
  const removeStaff = async (m) => {
    if (confirmId !== m.id) return setConfirmId(m.id);
    await supabase.from('staff_access').delete().eq('user_id', m.id);
    const { error } = await supabase.from('profiles').update({ role: 'member' }).eq('id', m.id);
    setConfirmId(null); setStaffEdit(null); flash(error ? 'Could not save: ' + error.message : 'Staff access removed'); await load();
  };
  const addEditCountry = (c) => { if (!c || staffEdit.countries.includes(c)) return; setStaffEdit({ ...staffEdit, countries: c === '*' ? ['*'] : [...staffEdit.countries.filter((x) => x !== '*'), c] }); setAddCountry(''); };
  const TABS = [
    (can('approve') || can('links')) && ['inbox', `Approvals${pending.length ? ' (' + pending.length + ')' : ''}`],
    can('coupons') && ['coupons', 'Coupons'],
    can('collections') && ['cols', 'Collections'],
    can('stores') && ['stores', 'Stores'],
    (can('approve') || can('links')) && ['pub', 'Published community content'],
    can('members') && ['members', 'Members'],
    owner && ['board', `Board${bPending.length ? ' (' + bPending.length + ')' : ''}`],
    owner && ['stats', 'Visitors'],
    owner && ['mag', 'Magazine'],
    owner && ['team', 'Team'],
  ].filter(Boolean);
  const shownTab = TABS.some(([k]) => k === tab) ? tab : (TABS[0] ? TABS[0][0] : '');
  const regionText = (s) => cname(s.country) + (s.area ? ' · ' + s.area : '');

  return (
    <main className="wrap" id="admin">
      <div className="tools"><h2>Admin area</h2><Link className="sm" href="/">View site</Link></div>
      <p style={{ color: 'var(--muted)' }}>{owner ? 'Add coupons, choose which collections they appear in, and approve or reject member recommendations and reviews. Nothing members submit is published without your approval.' : 'You are a staff admin. You can only do what the main admin allowed, in these countries: ' + (acc.countries.length ? acc.countries.map(cLabel).join(', ') : 'none yet') + '.'}</p>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={shownTab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {note && <div className="dlg-msg" style={{ marginBottom: 14 }}>{note}</div>}

      {shownTab === 'inbox' && (
        <>
          <div className="tools"><span className="hint">Waiting for approval: {pending.length}</span><button className="sm" onClick={load}>Refresh</button></div>
          {pending.length === 0 && <p className="empty">Nothing is waiting for approval right now.</p>}
          {pending.map((s) => (
            <div className="row" key={s.id}>
              <div className="info">
                {s.kind === 'rec' ? (
                  <>
                    <b>Coupon recommendation: {s.store}</b>
                    <span>{s.description}</span>
                    {s.code && <span>Code: {s.code}</span>}
                    {s.url && <span>Link (shown as text, not clickable, until it passes the check): <code>{s.url}</code></span>}
                    {s.url && <LinkBadge s={s} />}
                    {s.url && <span>Link terms accepted ✓ (v{s.terms_version})</span>}
                    <span>Valid in: {regionText(s)}</span>
                    <span>Category: {s.category || '-'}{s.category_other ? ' · suggested new category: ' + s.category_other : ''}{owner && s.category_other && <> <button className="sm" onClick={() => acceptCategory(s)}>Add this category to the site</button></>}</span>
                    <span>Requested collection: {s.collection_other ? s.collection_other + ' (new suggestion)' : colName(s.collection_id) || 'No preference'}{owner && s.collection_other && <> <button className="sm" onClick={() => acceptCollection(s)}>Add this collection to the site</button></>}</span>
                    {s.image_path && <img className="adm-img" alt="" src={imgUrl(s.image_path)} />}
                    {can('links') && <input className="replace-in" placeholder="Replace link with your own (optional)" aria-label="Replacement link" value={repl[s.id] || ''} onChange={(e) => setRepl({ ...repl, [s.id]: e.target.value })} />}
                  </>
                ) : (
                  <>
                    <b>Review of: {s.store} · <span className="stars">{stars(s.rating)}</span>{s.report === 'expired' ? ' · Reported expired' : s.report === 'failed' ? ' · Did not work' : ''}</b>
                    <span>{s.body || '(no text)'}</span>
                  </>
                )}
                <span>From {s.profiles ? s.profiles.email : 'member'}{s.profiles && s.profiles.username ? ' (@' + s.profiles.username + ')' : ''} ({memberState(s.user_id)}) · {fmt(s.created_at)}</span>
              </div>
              <div className="acts">
                {can('approve') && <button className="sm good" disabled={s.kind === 'rec' && !(repl[s.id] || '').trim() && !linkOk(s)} title={!linkOk(s) && !(repl[s.id] || '').trim() ? 'The link must pass the automatic check first' : ''} onClick={() => approve(s)}>Approve and publish</button>}
                {can('approve') && <button className="sm bad" onClick={() => reject(s)}>Reject</button>}
              </div>
            </div>
          ))}
        </>
      )}

      {shownTab === 'coupons' && (
        <>
          <div className="tools">{can('coupons') && <button className="sm good" onClick={() => openCoupon(null)}>+ Add coupon</button>}<span className="hint">{myCoupons.length} coupons</span></div>
          {form && (
            <form className="row" style={{ display: 'block' }} onSubmit={saveCoupon}>
              <h3 style={{ marginBottom: 8 }}>{editId ? 'Edit coupon' : 'New coupon'}</h3>
              <div className="fgrid">
                <div><label>Store name</label><input className="inline-input" required maxLength={60} value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} /></div>
                <div><label>Discount (display text)</label><input className="inline-input" required maxLength={30} placeholder="25% OFF" value={form.discount_text} onChange={(e) => setForm({ ...form, discount_text: e.target.value })} /></div>
                <div className="full"><label>Short description</label><input className="inline-input" required maxLength={140} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><label>Coupon code (leave empty for a deal without a code)</label><input className="inline-input" maxLength={40} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                <div><label>Link (affiliate or store)</label><input className="inline-input" type="url" maxLength={400} placeholder="https://" value={form.url} onChange={(e) => { setForm({ ...form, url: e.target.value }); setCouponCheck(''); }} /><button type="button" className="sm" style={{ marginTop: 6 }} onClick={checkCouponLink}>Check this link</button>{couponCheck && <div className="hint">{couponCheck}</div>}</div>
                <div><label>Category</label><select className="inline-input" value={form.category || catHook.names[0]} onChange={(e) => setForm({ ...form, category: e.target.value })}>{catHook.names.map((c) => <option key={c}>{c}</option>)}{owner && <option value="__new">+ New category…</option>}</select>{form.category === '__new' && <input className="inline-input" style={{ marginTop: 6 }} maxLength={30} placeholder="New category name" aria-label="New category name" value={formNewCat} onChange={(e) => setFormNewCat(e.target.value)} />}</div>
                <div className="full"><label>Picture (optional)</label>
                  {form.image_path && !couponFile && <div><img className="adm-img" alt="" src={imgUrl(form.image_path)} /> <button type="button" className="sm bad" onClick={() => setForm({ ...form, image_path: '' })}>Remove picture</button></div>}
                  <input type="file" accept="image/*" onChange={(e) => setCouponFile(e.target.files[0] || null)} />
                  <div className="hint">Shown at the top of the coupon card. The picture is shrunk automatically.</div>
                </div>
                <div><label>Type</label><select className="inline-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="verified">Verified Deal – verified by Dealora</option><option value="community">Community Deal – from the community</option></select></div>
                <div><label>Country</label><select className="inline-input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>{formCountries.map((c) => <option key={c} value={c}>{cname(c)}</option>)}</select></div>
                <div><label>Area or city (optional)</label><input className="inline-input" maxLength={120} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
                <div><label>Users saved (text)</label><input className="inline-input" maxLength={20} placeholder="1.2K" value={form.used_text} onChange={(e) => setForm({ ...form, used_text: e.target.value })} /></div>
                <div><label>Expiry date</label><input className="inline-input" type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} /></div>
                <div className="full"><label>Show in these collections</label>
                  <div className="checks">
                    {cols.map((c) => (
                      <label key={c.id}><input type="checkbox" checked={form.collection_ids.includes(c.id)} onChange={(e) => setForm({ ...form, collection_ids: e.target.checked ? [...form.collection_ids, c.id] : form.collection_ids.filter((x) => x !== c.id) })} /> {c.name}</label>
                    ))}
                  </div>
                  {owner && <input className="inline-input" style={{ marginTop: 8 }} maxLength={60} placeholder="Or create a new collection and add this coupon to it" aria-label="New collection name" value={formNewCol} onChange={(e) => setFormNewCol(e.target.value)} />}
                  <div className="hint">With no collection, the coupon appears under “More deals” and in search.</div>
                </div>
                <div className="full"><div className="checks"><label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (visible on the site)</label></div></div>
              </div>
              <div className="dlg-actions"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-solid" type="submit">Save</button></div>
            </form>
          )}
          {myCoupons.length === 0 && !form && <p className="empty">No coupons yet. Click “Add coupon”.</p>}
          <div className="tools">
            <label htmlFor="cf" style={{ margin: 0 }}>Show country</label>
            <select id="cf" className="inline-input" style={{ width: 'auto' }} value={cFilter} onChange={(e) => setCFilter(e.target.value)}>
              <option value="">All countries</option>
              {couponCountries.map((c) => <option key={c} value={c}>{cname(c)} ({myCoupons.filter((x) => (x.country || 'WW') === c).length})</option>)}
            </select>
          </div>
          {couponCountries.filter((c) => !cFilter || c === cFilter).map((cc) => (
            <section key={cc} style={{ marginBottom: 18 }}>
              <h3 style={{ margin: '14px 0 6px' }}>{cname(cc)} <span className="hint">· {myCoupons.filter((x) => (x.country || 'WW') === cc).length} coupons</span></h3>
              {myCoupons.filter((x) => (x.country || 'WW') === cc).map((c) => (
                <div className="row" key={c.id}>
                  <div className="info">
                    <b>{c.store} — {c.discount_text}</b>
                    <span>{c.area ? c.area + ' · ' : ''}{c.category} · Collections: {(c.collection_ids || []).map(colName).filter(Boolean).join(', ') || 'No collection'} · {c.active ? 'Visible' : 'Hidden'}{c.expires_on && c.expires_on < new Date().toISOString().slice(0, 10) ? ' · Expired' : ''}</span>
                  </div>
                  <div className="acts">
                    {can('coupons') && <button className="sm" onClick={() => openCoupon(c)}>Edit</button>}
                    {can('coupons') && <button className="sm" onClick={() => toggleActive(c)}>{c.active ? 'Hide' : 'Show'}</button>}
                    {can('delete_coupons') && <button className="sm bad" onClick={() => delCoupon(c)}>{confirmId === c.id ? 'Click again to delete' : 'Delete'}</button>}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </>
      )}

      {shownTab === 'cols' && (
        <>
          <form className="tools" onSubmit={addCol}>
            <input className="inline-input" style={{ flex: 1, minWidth: 200 }} placeholder="New collection name" maxLength={60} value={newCol} onChange={(e) => setNewCol(e.target.value)} />
            <button className="sm good" type="submit">+ Add collection</button>
          </form>
          {cols.map((c, i) => (
            <div className="row" key={c.id}>
              <div className="info">
                <input className="inline-input" defaultValue={c.name} maxLength={60} aria-label="Collection name" onBlur={(e) => renameCol(c, e.target.value)} />
                <span>{myCoupons.filter((d) => (d.collection_ids || []).includes(c.id)).length} coupons</span>
              </div>
              <div className="acts">
                <button className="sm" disabled={i === 0} onClick={() => moveCol(i, -1)}>↑</button>
                <button className="sm" disabled={i === cols.length - 1} onClick={() => moveCol(i, 1)}>↓</button>
                <button className="sm bad" onClick={() => delCol(c)}>{confirmId === c.id ? 'Click again to delete' : 'Delete'}</button>
              </div>
            </div>
          ))}
          <p className="hint">This order is the order collections appear on the homepage. A collection shows on the homepage once it has at least one coupon: open a coupon and tick the collection.</p>
          {owner && (<>
            <h3 style={{ marginTop: 28 }}>Categories</h3>
            <p className="hint" style={{ marginBottom: 8 }}>The row of icons at the top of the homepage. Renaming a category updates all its coupons.</p>
            <form className="tools" onSubmit={addCat}>
              <input className="inline-input" style={{ flex: 1, minWidth: 200 }} placeholder="New category name" maxLength={30} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <button className="sm good" type="submit">+ Add category</button>
            </form>
            {catHook.rows.map((r, i) => (
              <div className="row" key={r.id}>
                <div className="info">
                  <input className="inline-input" defaultValue={r.name} maxLength={30} aria-label="Category name" onBlur={(e) => renameCat(r, e.target.value)} />
                  <span>{coupons.filter((d) => d.category === r.name).length} coupons</span>
                </div>
                <div className="acts">
                  <button className="sm" disabled={i === 0} onClick={() => moveCat(i, -1)}>↑</button>
                  <button className="sm" disabled={i === catHook.rows.length - 1} onClick={() => moveCat(i, 1)}>↓</button>
                  <button className="sm bad" onClick={() => delCat(r)}>{confirmId === r.id ? 'Click again to delete' : 'Delete'}</button>
                </div>
              </div>
            ))}
          </>)}
        </>
      )}

      {shownTab === 'pub' && (
        <>
          {published.length === 0 && <p className="empty">Nothing published yet.</p>}
          {published.map((s) => (
            <div className="row" key={s.id}>
              <div className="info">
                <b>{s.kind === 'rec' ? 'Recommendation' : 'Review'}: {s.store}{s.kind === 'review' ? ' · ' + stars(s.rating) : ''}</b>
                <span>{s.kind === 'rec' ? s.description : s.body}</span>
                {s.kind === 'rec' && can('links') && (
                  <input className="replace-in" aria-label="Link" placeholder="Link (empty = none)" defaultValue={s.url || ''} onBlur={(e) => { if ((e.target.value.trim() || '') !== (s.url || '')) saveLink(s, e.target.value); }} />
                )}
                {s.kind === 'rec' && s.url && <LinkBadge s={s} />}
                {s.original_url && <span>Originally submitted link: {s.original_url}</span>}
              </div>
              <div className="acts">{can('approve') && <button className="sm bad" onClick={() => reject(s)}>Remove from site</button>}</div>
            </div>
          ))}
        </>
      )}

      {shownTab === 'members' && (
        <>
          <div className="tools">
            <span className="hint">{members.length} members · {members.filter(isPaid).length} Verified</span>
          </div>
          <p className="hint" style={{ marginBottom: 12 }}>Three separate email lists. Paste each into your email service (for example Mailchimp or Brevo) and send only the matching kind of email. Real-time deal emails go to Verified Users who have not paused them. Marketing emails and the magazine go only to members who opted in.</p>
          <div className="tools">
            <label htmlFor="mf" style={{ margin: 0 }}>Send lists for country</label>
            <select id="mf" className="inline-input" style={{ width: 'auto' }} value={mFilter} onChange={(e) => setMFilter(e.target.value)}>
              <option value="">All countries</option>
              {memberCountries.map((c) => <option key={c || '_none'} value={c || '_none'}>{c ? cname(c) : 'Country not set'} ({members.filter((m) => (m.country || '') === c).length})</option>)}
            </select>
          </div>
          {[['realtime', 'Real-time deal emails (Verified Users)'], ['marketing', 'Marketing emails (opted in)'], ['magazine', 'Monthly magazine (opted in)']].map(([k, label]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <div className="tools"><b>{label} · {lists[k].length}</b><button className="sm" onClick={() => copyList(k)}>Copy</button></div>
              <textarea readOnly rows={2} aria-label={label} className="inline-input" style={{ height: 'auto', padding: 10 }} value={lists[k].join(', ')} />
            </div>
          ))}
          {detail && (
            <div className="row" style={{ display: 'block' }}>
              <h3 style={{ margin: 0 }}>{detail.email}{detail.username ? ' (@' + detail.username + ')' : ''} · {isPaid(detail) ? 'Verified' : 'Free'} · {detail.country ? cname(detail.country) : 'Country not set'}</h3>
              <div style={{ margin: '10px 0', padding: 10, border: '1px solid var(--line)', borderRadius: 10 }}>
                {can('points') ? null : <span className="hint">You do not have permission to change points.</span>}
                <b>Points: {(members.find((x) => x.id === detail.id) || detail).points || 0}</b>
                {can('points') && <div className="tools" style={{ marginTop: 8 }}>
                  <input className="inline-input" style={{ width: 110 }} type="number" step="1" placeholder="+25 or -10" aria-label="Points to add" value={ptsDelta} onChange={(e) => setPtsDelta(e.target.value)} />
                  <input className="inline-input" style={{ flex: 1, minWidth: 160 }} maxLength={200} placeholder="Reason (the member sees it)" aria-label="Reason" value={ptsReason} onChange={(e) => setPtsReason(e.target.value)} />
                  <button className="sm good" onClick={addPoints}>Add / remove points</button>
                </div>}
                {can('points') && <div className="tools" style={{ marginTop: 8 }}>
                  <input className="inline-input" style={{ width: 110 }} type="number" step="1" min="0" placeholder="Total" aria-label="Set the total points" value={ptsTotal} onChange={(e) => setPtsTotal(e.target.value)} />
                  <button className="sm" onClick={setTotal}>Set exact total</button>
                  <span className="hint">1 point is added automatically for each approved coupon and each approved review. You can always change the total up or down.</span>
                </div>}
                {ptsLog.length > 0 && <div style={{ fontSize: 13, maxHeight: 120, overflow: 'auto' }}>{ptsLog.map((l) => <div key={l.id}>{fmt(l.created_at)} · {l.delta > 0 ? '+' : ''}{l.delta}{l.reason ? ' · ' + l.reason : ''}</div>)}</div>}
              </div>
              {owner && detail.role === 'member' && (
                <div style={{ margin: '10px 0', padding: 10, border: '1px solid var(--line)', borderRadius: 10 }}>
                  <b>Chat and membership</b>
                  <label className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '8px 0' }}><input type="checkbox" checked={!!(members.find((x) => x.id === detail.id) || detail).board_restricted} onChange={(e) => setRestricted(detail.id, e.target.checked)} /> I must approve this member’s chat messages before they show</label>
                  <div className="tools">
                    <input className="inline-input" style={{ flex: 1, minWidth: 160 }} maxLength={300} placeholder="Reason for removal (kept privately)" aria-label="Reason for removal" value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
                    <button className="sm bad" onClick={() => removeMember(detail)}>{confirmId === 'rm' + detail.id ? 'Confirm: remove membership' : 'Remove membership'}</button>
                  </div>
                  <span className="hint">Removing deletes the account and everything it posted, and that email cannot join again.</span>
                </div>
              )}
              <p className="hint">Interests: {ivText(detail)}</p>
              {[['Searches', 'search', (r) => r.detail], ['Categories browsed', 'category', (r) => r.detail], ['Regions chosen', 'region', (r) => r.detail && cname(r.detail)]].map(([label, kind, fn]) => (
                <p key={kind} style={{ margin: '6px 0' }}><b>{label}:</b> {tally(acts.filter((r) => r.kind === kind), fn).map(([k, n]) => k + (n > 1 ? ' ×' + n : '')).join(' · ') || 'none yet'}</p>
              ))}
              <p style={{ margin: '6px 0' }}><b>Coupons used:</b> {tally(acts.filter((r) => ['reveal', 'copy', 'open'].includes(r.kind)), (r) => r.store).map(([k, n]) => k + ' ×' + n).join(' · ') || 'none yet'}</p>
              <details><summary className="hint">Full activity log ({acts.length})</summary>
                <div style={{ maxHeight: 220, overflow: 'auto', fontSize: 13 }}>{acts.map((r) => <div key={r.id}>{fmt(r.created_at)} · {r.kind}{r.store ? ' · ' + r.store : ''}{r.detail ? ' · ' + r.detail : ''}</div>)}</div>
              </details>
              <div className="acts" style={{ marginTop: 10 }}><button className="sm" onClick={() => setDetail(null)}>Close</button> <button className="sm good" onClick={copySummary}>Copy summary</button>{owner && <> <button className="sm" onClick={() => announceMember(detail)}>Announce on board</button></>}</div>
            </div>
          )}
          {picksFor && (
            <div className="row" style={{ display: 'block' }}>
              <h3 style={{ margin: 0 }}>Personal page for {picksFor.email} · {month}</h3>
              <p className="hint">Their answers: {ivText(picksFor)}</p>
              <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 10, margin: '8px 0' }}>
                {myCoupons.filter((c) => c.active).map((c) => (
                  <label key={c.id} className="optin" style={{ margin: '4px 0' }}><input type="checkbox" checked={pickIds.includes(c.id)} onChange={() => togglePick(c.id)} /><span>{c.store} · {c.discount_text} · {c.category} · {cname(c.country)}</span></label>
                ))}
              </div>
              <label htmlFor="pk-note">Note to the member (optional, 500 characters)</label>
              <textarea id="pk-note" maxLength={500} value={pickNote} onChange={(e) => setPickNote(e.target.value)} />
              <div className="acts"><button className="sm" onClick={() => setPicksFor(null)}>Cancel</button> <button className="sm" onClick={savePicks}>Save personal page</button></div>
            </div>
          )}
          {members.filter(inM).map((m) => (
            <div className="row" key={m.id}>
              <div className="info"><b>{m.email}{m.username ? ' · @' + m.username : ''}</b><span>{m.role === 'admin' ? 'Admin' : m.paid ? 'Verified ' + (m.paid_at ? fmt(m.paid_at) : '') : 'Free'} · {m.country ? cname(m.country) : 'No country'} · Joined {fmt(m.created_at)} · {m.points || 0} pts · Marketing: {m.marketing ? 'yes' : 'no'} · Magazine: {m.magazine ? 'yes' : 'no'}{isPaid(m) ? ' · Real-time: ' + (m.realtime_off ? 'paused' : 'on') : ''}{isPaid(m) ? ' · ' + ivText(m) : ''}</span></div>
              <div className="acts">
                <button className="sm" onClick={() => openDetail(m)}>Activity</button>
                {isPaid(m) && can('picks') && <button className="sm" onClick={() => openPicks(m)}>Personal page</button>}
                {owner && m.role === 'member' && <button className="sm" onClick={() => setPaid(m, !m.paid)}>{m.paid ? 'Remove Verified status' : 'Grant Verified (free)'}</button>}
              </div>
            </div>
          ))}
        </>
      )}

      {shownTab === 'stores' && can('stores') && (
        <>
          <p className="hint" style={{ marginBottom: 10 }}>The “Popular Stores” area on the home page. By default the store with the most coupons comes first. A store shows on the home page once it has at least one coupon.</p>
          <form className="row" style={{ display: 'block' }} onSubmit={addStoreFn}>
            <b>Add or update a store</b>
            <input className="inline-input" style={{ width: '100%', margin: '8px 0' }} maxLength={60} placeholder="Store name (same spelling as in the coupons)" aria-label="Store name" value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} />
            <textarea className="inline-input" rows={2} maxLength={300} placeholder="Short text about the store (optional)" aria-label="Store text" style={{ width: '100%', height: 'auto', padding: 10 }} value={newStore.description} onChange={(e) => setNewStore({ ...newStore, description: e.target.value })} />
            <div className="tools" style={{ marginTop: 8 }}>
              <input type="file" accept="image/*" aria-label="Store picture" onChange={(e) => setNewStore({ ...newStore, file: e.target.files[0] || null })} />
              <button className="sm good" type="submit">Save store</button>
            </div>
          </form>
          <div className="tools" style={{ marginTop: 18 }}>
            <b>Order: {storeManual ? 'set by you' : 'automatic (most coupons first)'}</b>
            {storeManual && <button className="sm" onClick={resetStoreOrder}>Back to automatic order (by number of coupons)</button>}
          </div>
          {sList.length === 0 && <p className="empty">No stores yet. Stores appear here as coupons are added.</p>}
          {sList.map((st, i) => (
            <div className="row" key={st.key} style={{ alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }}>
                {st.row && st.row.image_path ? <img className="adm-img" alt="" src={imgUrl(st.row.image_path)} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 12 }} /> : <span className="mono" style={{ width: 56, height: 56, flex: 'none' }}>{st.name.slice(0, 2).toUpperCase()}</span>}
                <div className="info" style={{ flex: 1, minWidth: 0 }}>
                  {owner ? <input className="inline-input" defaultValue={st.name} maxLength={60} aria-label="Store name" onBlur={(e) => renameStore(st, e.target.value)} /> : <b>{st.name}</b>}
                  <span>{i + 1}. {st.count} coupon{st.count === 1 ? '' : 's'}{st.count === 0 ? ' · not shown on the home page yet' : ''}</span>
                  <textarea className="inline-input" rows={2} maxLength={300} placeholder="Short text about the store" aria-label="Store text" style={{ width: '100%', height: 'auto', padding: 8 }} defaultValue={(st.row && st.row.description) || ''} onBlur={(e) => { if (e.target.value.trim() !== ((st.row && st.row.description) || '')) saveStore(st, { description: e.target.value.trim() || null }); }} />
                  <label className="hint">Picture: <input type="file" accept="image/*" onChange={(e) => storePic(st, e.target.files[0])} /></label>
                </div>
              </div>
              <div className="acts">
                <button className="sm" disabled={i === 0} onClick={() => moveStore(i, -1)} aria-label="Move up">↑</button>
                <button className="sm" disabled={i === sList.length - 1} onClick={() => moveStore(i, 1)} aria-label="Move down">↓</button>
                {owner && st.row && <button className="sm bad" onClick={() => delStore(st)}>{confirmId === 's' + st.key ? 'Click again to delete' : 'Delete details'}</button>}
              </div>
            </div>
          ))}
        </>
      )}

      {shownTab === 'stats' && owner && <AdminStats members={members} flash={flash} />}
      {shownTab === 'mag' && owner && <AdminMagazine coupons={coupons} members={members} token={token} flash={flash} />}

      {shownTab === 'board' && owner && (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>The board on the home page. Only you write here. Visitors can reply or vote only on posts you open. Replies appear after you approve them.</p>
          <div className="tools"><b>New on the site, waiting for your decision ({queueCoupons.length + queueSubs.length})</b><button className="sm" onClick={load}>Refresh</button></div>
          <p className="hint" style={{ marginBottom: 8 }}>Choose what to show on the home page board. Coupons and member shares appear as small cards. A review appears next to the coupon it is about.</p>
          {queueCoupons.length + queueSubs.length === 0 && <p className="empty">Nothing new is waiting.</p>}
          {queueCoupons.map((c) => (
            <div className="row" key={'c' + c.id}>
              <div className="info"><b>Coupon: {c.store} · {c.discount_text}</b><span>{c.description}</span><span>{cLabel(c.country)}</span></div>
              <div className="acts"><button className="sm good" onClick={() => showCoupon(c)}>Show on board</button><button className="sm" onClick={() => showCoupon(c, 'hidden')}>Skip</button></div>
            </div>
          ))}
          {queueSubs.map((x) => (
            <div className="row" key={'s' + x.id}>
              <div className="info">
                {x.kind === 'rec' ? <><b>Member coupon: {x.store}</b><span>{x.description}</span></> : <><b>Review of {x.store} · <span className="stars">{stars(x.rating)}</span></b><span>{x.body || '(no text)'}</span>{x.coupon_id && <span>Will appear next to its coupon</span>}</>}
                <span>From {x.profiles && x.profiles.username ? '@' + x.profiles.username : 'member'}</span>
              </div>
              <div className="acts"><button className="sm good" onClick={() => showSub(x)}>Show on board</button><button className="sm" onClick={() => showSub(x, 'hidden')}>Skip</button><button className="sm bad" onClick={() => delSub(x)}>{confirmId === x.id ? 'Confirm delete' : 'Delete'}</button></div>
            </div>
          ))}

          <form className="row" style={{ display: 'block', marginTop: 18 }} onSubmit={addBoardPost}>
            <b>New post</b>
            <div className="tools" style={{ marginTop: 8 }}>
              <label htmlFor="bk" style={{ margin: 0 }}>Type</label>
              <select id="bk" className="inline-input" style={{ width: 'auto' }} value={bForm.kind} onChange={(e) => setBForm({ ...bForm, kind: e.target.value })}>
                <option value="announcement">News / message</option>
                <option value="question">Open a chat (members reply, you approve)</option>
                <option value="poll">Multiple-choice question (members vote)</option>
              </select>
            </div>
            <input className="inline-input" maxLength={100} placeholder="Title" aria-label="Title" value={bForm.title} onChange={(e) => setBForm({ ...bForm, title: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
            <textarea className="inline-input" rows={3} maxLength={1000} placeholder="Text (optional)" aria-label="Text" value={bForm.body} onChange={(e) => setBForm({ ...bForm, body: e.target.value })} style={{ width: '100%', height: 'auto', padding: 10 }} />
            {bForm.kind === 'poll' && <div className="tools" style={{ marginTop: 8 }}><span className="hint">Quick answers:</span><button type="button" className="sm" onClick={() => setBForm({ ...bForm, options: 'Yes\nNo' })}>Yes / No</button><button type="button" className="sm" onClick={() => setBForm({ ...bForm, options: 'Yes\nNo\nNot sure' })}>Yes / No / Not sure</button></div>}
            {bForm.kind === 'poll' && <textarea className="inline-input" rows={4} placeholder={'Options, one per line (2 to 6)'} aria-label="Poll options" value={bForm.options} onChange={(e) => setBForm({ ...bForm, options: e.target.value })} style={{ width: '100%', height: 'auto', padding: 10, marginTop: 8 }} />}
 {(bForm.kind === 'question' || bForm.replies_open) && (
              <div className="tools" style={{ marginTop: 8 }}>
                <label htmlFor="bm" style={{ margin: 0 }}>Chat mode</label>
                <select id="bm" className="inline-input" style={{ width: 'auto' }} value={bForm.chat_mode} onChange={(e) => setBForm({ ...bForm, chat_mode: e.target.value })}>
                  <option value="moderated">Moderated: I approve every message</option>
                  <option value="free">Free chat: messages show at once</option>
                </select>
              </div>
            )}
            {bForm.kind !== 'question' && <label className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}><input type="checkbox" checked={bForm.replies_open} onChange={(e) => setBForm({ ...bForm, replies_open: e.target.checked })} /> Let members reply</label>}
            <div className="acts" style={{ marginTop: 10 }}><button className="sm good" type="submit">Post to the board</button></div>
          </form>

          <div className="tools" style={{ marginTop: 18 }}><b>Replies waiting for approval: {bPending.length}</b></div>
          {bPending.length === 0 && <p className="empty">No replies are waiting.</p>}
          {bPending.map((c) => (
            <div className="row" key={c.id}>
              <div className="info"><b>{c.profiles && c.profiles.username ? '@' + c.profiles.username : 'Member'}{c.profiles && c.profiles.board_restricted ? ' · restricted' : ''}</b><span>{c.body}</span><span>On: {(bPosts.find((p) => p.id === c.post_id) || {}).title || 'a post'}</span></div>
              <div className="acts"><button className="sm good" onClick={() => replyDecide(c, 'approved')}>Approve</button><button className="sm bad" onClick={() => replyDecide(c, 'rejected')}>Reject</button></div>
            </div>
          ))}

          <div className="tools" style={{ marginTop: 18 }}><b>Recent chat messages (already visible)</b></div>
          {chatMsgs.length === 0 && <p className="empty">No visible messages yet.</p>}
          {chatMsgs.map((c) => (
            <div className="row" key={c.id}>
              <div className="info"><b>{c.profiles && c.profiles.username ? '@' + c.profiles.username : 'Member'}{c.profiles && c.profiles.board_restricted ? ' · restricted' : ''}</b><span>{c.body}</span><span>On: {(bPosts.find((p) => p.id === c.post_id) || {}).title || 'a post'} · {fmt(c.created_at)}</span></div>
              <div className="acts">
                <button className="sm bad" onClick={() => replyDecide(c, 'rejected')}>Remove message</button>
                {!(c.profiles && c.profiles.board_restricted) && <button className="sm" onClick={() => setRestricted(c.user_id, true)}>Restrict member</button>}
                <button className="sm bad" onClick={() => removeMember({ id: c.user_id })}>{confirmId === 'rm' + c.user_id ? 'Confirm: remove membership' : 'Remove membership'}</button>
              </div>
            </div>
          ))}

          <div className="tools" style={{ marginTop: 18 }}><b>Posts</b></div>
          {bPosts.length === 0 && <p className="empty">No posts yet.</p>}
          {bPosts.map((p) => (
            <div className="row" key={p.id}>
              <div className="info"><b>{p.title}{p.pinned ? ' · Pinned' : ''}</b><span>{p.kind} · {p.status}{p.replies_open ? ' · chat open (' + (p.chat_mode === 'free' ? 'free' : 'moderated') + ')' : ''} · {fmt(p.created_at)}</span></div>
              <div className="acts">
                <button className="sm" onClick={() => boardUpd(p, { pinned: !p.pinned })}>{p.pinned ? 'Unpin' : 'Pin'}</button>
                <button className="sm" onClick={() => boardUpd(p, { replies_open: !p.replies_open })}>{p.replies_open ? 'Close chat' : 'Open chat'}</button>
                {p.replies_open && <button className="sm" onClick={() => boardUpd(p, { chat_mode: p.chat_mode === 'free' ? 'moderated' : 'free' })}>{p.chat_mode === 'free' ? 'Switch to moderated' : 'Switch to free chat'}</button>}
                <button className="sm" onClick={() => boardUpd(p, { status: p.status === 'published' ? 'closed' : 'published' })}>{p.status === 'published' ? 'Close' : 'Reopen'}</button>
                <button className="sm" onClick={() => boardUpd(p, { status: p.status === 'hidden' ? 'published' : 'hidden' })}>{p.status === 'hidden' ? 'Show' : 'Hide'}</button>
                <button className="sm bad" onClick={() => boardDel(p)}>{confirmId === p.id ? 'Confirm delete' : 'Delete'}</button>
              </div>
            </div>
          ))}
        </>
      )}

      {shownTab === 'team' && owner && (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>You are the main admin and can do everything. A staff admin can only do what you tick here, and only in the countries you choose. These limits are enforced by the database, not only by the screen.</p>
          <div className="tools">
            <select className="inline-input" style={{ width: 'auto', maxWidth: '100%' }} aria-label="Member to make staff admin" value={newStaff} onChange={(e) => setNewStaff(e.target.value)}>
              <option value="">Add a staff admin: choose a registered member…</option>
              {members.filter((m) => m.role === 'member').map((m) => <option key={m.id} value={m.id}>{m.email}{m.username ? ' (@' + m.username + ')' : ''}</option>)}
            </select>
            <button className="sm good" disabled={!newStaff} onClick={addStaff}>Make staff admin</button>
          </div>
          {staffMembers.length === 0 && <p className="empty">No staff admins yet. The person must register on the site first, then you can pick them above.</p>}
          {staffEdit && (
            <div className="row" style={{ display: 'block' }}>
              <h3 style={{ margin: 0 }}>Limits for {(members.find((m) => m.id === staffEdit.user_id) || {}).email}</h3>
              <label style={{ marginTop: 10 }}>Countries this person works on</label>
              <div className="checks" style={{ marginBottom: 8 }}>
                {staffEdit.countries.length === 0 && <span className="hint">None yet: they cannot see or change anything.</span>}
                {staffEdit.countries.map((c) => <button key={c} type="button" className="sm" onClick={() => setStaffEdit({ ...staffEdit, countries: staffEdit.countries.filter((x) => x !== c) })}>{cLabel(c)} ✕</button>)}
              </div>
              <select className="inline-input" style={{ width: 'auto' }} aria-label="Add country" value={addCountry} onChange={(e) => addEditCountry(e.target.value)}>
                <option value="">Add a country…</option>
                <option value="*">All countries</option>
                {allCountries.filter((c) => !staffEdit.countries.includes(c)).map((c) => <option key={c} value={c}>{cname(c)}</option>)}
              </select>
              <label style={{ marginTop: 12 }}>What this person may do</label>
              <div className="checks" style={{ display: 'block' }}>
                {PERMS.map(([k, label]) => (
                  <label key={k} style={{ display: 'block', margin: '4px 0' }}><input type="checkbox" checked={!!staffEdit[k]} onChange={(e) => setStaffEdit({ ...staffEdit, [k]: e.target.checked })} /> {label}</label>
                ))}
              </div>
              <p className="hint">Never allowed for staff: granting Verified status, creating other staff admins, and seeing members outside their countries.</p>
              <div className="acts"><button className="sm" onClick={() => setStaffEdit(null)}>Cancel</button> <button className="sm good" onClick={saveStaff}>Save limits</button></div>
            </div>
          )}
          {staffMembers.map((m) => {
            const a = accessOf(m.id);
            const on = PERMS.filter(([k]) => a[k]).map(([, l]) => l.replace(/ \(.*\)$/, ''));
            return (
              <div className="row" key={m.id}>
                <div className="info">
                  <b>{m.email}{m.username ? ' · @' + m.username : ''}</b>
                  <span>Countries: {a.countries.length ? a.countries.map(cLabel).join(', ') : 'none yet'}</span>
                  <span>May: {on.length ? on.join('; ') : 'nothing yet'}</span>
                </div>
                <div className="acts">
                  <button className="sm" onClick={() => setStaffEdit({ ...a, countries: a.countries || [] })}>Edit limits</button>
                  <button className="sm bad" onClick={() => removeStaff(m)}>{confirmId === m.id ? 'Click again to remove' : 'Remove staff access'}</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}
