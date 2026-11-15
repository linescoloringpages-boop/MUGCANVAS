'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { cname, sortedCountries } from '../../lib/regions';
import InterestsForm, { EMPTY_INTERESTS } from '../../components/InterestsForm';

export default function Account() {
  const auth = useAuth();
  const [msg, setMsg] = useState('');
  const [interests, setInterests] = useState(EMPTY_INTERESTS);
  const [uname, setUname] = useState('');
  const [plog, setPlog] = useState([]);

  useEffect(() => {
    if (!auth.user) return;
    supabase.from('points_log').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(20).then(({ data }) => setPlog(data || []));
  }, [auth.user]);
  useEffect(() => { if (auth.profile) setUname(auth.profile.username || ''); }, [auth.profile]);
  useEffect(() => { if (auth.profile) setInterests({ ...EMPTY_INTERESTS, ...(auth.profile.interests || {}) }); }, [auth.profile]);

  if (auth.loading) return <div className="authcard"><p>Loading…</p></div>;
  if (!auth.user) return <div className="authcard"><h1>Account</h1><p>Please sign in.</p><Link className="btn btn-solid" href="/login">Sign in</Link></div>;

  const p = auth.profile || {};
  const save = async (patch, ok) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', auth.user.id);
    setMsg(error ? 'Could not save. Please try again.' : ok);
    await auth.refresh();
  };
  const now = () => new Date().toISOString();
  const nextChange = p.username && p.username_changed_at ? new Date(new Date(p.username_changed_at).getTime() + 30 * 86400000) : null;
  const locked = !!nextChange && nextChange > new Date();
  const saveName = async () => {
    const un = uname.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(un)) return setMsg('Username: 3 to 20 letters, numbers or underscores.');
    if (un.toLowerCase() === (p.username || '').toLowerCase()) return save({ username: un }, 'Username saved.');
    const { data: free } = await supabase.rpc('username_available', { u: un });
    if (!free) return setMsg('That username is taken or not allowed.');
    const { error } = await supabase.from('profiles').update({ username: un }).eq('id', auth.user.id);
    setMsg(error ? (/once a month/.test(error.message) ? 'You can change your username once a month.' : 'That username is taken or not allowed.') : 'Username saved.');
    await auth.refresh();
  };
  const toggleMarketing = () => save({ marketing: !p.marketing, marketing_consent_at: !p.marketing ? now() : null }, !p.marketing ? 'Marketing emails are on.' : 'Marketing emails are off.');
  const toggleMagazine = () => save({ magazine: !p.magazine, magazine_consent_at: !p.magazine ? now() : null }, !p.magazine ? 'The monthly magazine is on.' : 'The monthly magazine is off.');
  const toggleRealtime = () => save({ realtime_off: !p.realtime_off }, !p.realtime_off ? 'Real-time deal emails are paused.' : 'Real-time deal emails are on.');

  return (
    <div className="authcard" style={{ maxWidth: 560 }}>
      <Link className="logo" href="/" style={{ marginBottom: 20 }}>DEALORA</Link>
      <h1>Your account</h1>
      <p>{p.email}</p>
      <p>Membership: <b>{auth.paid ? 'Verified User' : 'Free member'}</b></p>
      {!auth.paid && <Link className="btn btn-solid" href="/join">Become a Verified User</Link>}
      {auth.paid && <Link className="btn btn-solid" href="/for-you">Open my personal page</Link>}

      <label htmlFor="un" style={{ display: 'block', marginTop: 20, fontWeight: 600, fontSize: 14 }}>Username (shown publicly next to what you share)</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="un" maxLength={20} disabled={locked} value={uname} onChange={(e) => setUname(e.target.value)} placeholder={p.username ? '' : 'Choose a username'} />
        <button className="btn btn-solid" type="button" disabled={locked} onClick={saveName}>Save</button>
      </div>
      <p className="hint">{locked ? 'You can change your username again on ' + nextChange.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }) + '.' : 'You can change your username once a month.'}</p>

      <h3 style={{ margin: '24px 0 4px' }}>Your points: {p.points || 0}</h3>
      {plog.length === 0 ? <p className="hint">Points you earn for useful coupons and reviews appear here. The Dealora team adds them for now.</p> : (
        <div style={{ fontSize: 14 }}>{plog.map((l) => <div key={l.id}>{new Date(l.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })} · {l.delta > 0 ? '+' : ''}{l.delta}{l.reason ? ' · ' + l.reason : ''}</div>)}</div>
      )}

      <label htmlFor="cty" style={{ display: 'block', marginTop: 20, fontWeight: 600, fontSize: 14 }}>Country where you live</label>
      <select id="cty" value={p.country || ''} onChange={(e) => save({ country: e.target.value || null }, 'Country saved.')}>
        <option value="">Not set</option>
        {sortedCountries().map((c) => <option key={c} value={c}>{cname(c)}</option>)}
      </select>

      <h3 style={{ margin: '24px 0 4px' }}>Email choices</h3>
      <label className="optin"><input type="checkbox" checked={!!p.marketing} onChange={toggleMarketing} /><span>Marketing emails: deals, offers and news</span></label>
      <label className="optin"><input type="checkbox" checked={!!p.magazine} onChange={toggleMagazine} /><span>The monthly Dealora magazine</span></label>
      {auth.paid && <label className="optin"><input type="checkbox" checked={!p.realtime_off} onChange={toggleRealtime} /><span>Real-time deal emails (a Verified User benefit)</span></label>}
      {msg && <div className="dlg-msg" style={{ marginTop: 14 }}>{msg}</div>}

      {auth.paid && (
        <>
          <h3 style={{ margin: '24px 0 4px' }}>Your interests</h3>
          <p className="hint">We use these to prepare your personal page.</p>
          <InterestsForm value={interests} onChange={setInterests} />
          <button className="btn btn-solid" onClick={() => save({ interests }, 'Your interests are saved.')}>Save my interests</button>
        </>
      )}
      <div className="alt"><Link href="/">Back to deals</Link></div>
    </div>
  );
}
