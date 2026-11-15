'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
const BOX = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', flex: '1 1 150px', minWidth: 140 };

// Admin tab: how many people visited, and the numbers shown to visitors.
export default function AdminStats({ members, flash }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const [shownM, setShownM] = useState('');
  const [shownV, setShownV] = useState('');

  const realMembers = members.filter((m) => m.role !== 'admin').length;
  const realVerified = members.filter((m) => m.paid).length;

  const load = useCallback(async () => {
    setErr('');
    const a = await supabase.rpc('visit_stats');
    if (a.error) setErr('Could not load the visitor numbers. Did you run the latest SQL file in Supabase? (' + a.error.message + ')'); else setSt(a.data);
    const b = await supabase.from('site_settings').select('value').eq('key', 'display_numbers').maybeSingle();
    const v = (b.data && b.data.value) || {};
    setShownM(v.members == null ? '' : String(v.members)); setShownV(v.verified == null ? '' : String(v.verified));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const clean = (x) => String(x).replace(/[^0-9]/g, '').slice(0, 9);
    const value = { members: clean(shownM), verified: clean(shownV) };
    const { error } = await supabase.from('site_settings').upsert({ key: 'display_numbers', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    flash(error ? 'Could not save: ' + error.message : 'Saved. Visitors now see these numbers.');
    if (!error) load();
  };
  const reset = async () => {
    const { error } = await supabase.from('site_settings').upsert({ key: 'display_numbers', value: { members: '', verified: '' }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    flash(error ? 'Could not save: ' + error.message : 'Back to the real numbers.'); if (!error) load();
  };

  const max = st ? Math.max(1, ...st.days.map((d) => d.n)) : 1;
  return (
    <>
      <div className="tools"><b>Visitors</b><button className="sm" onClick={load}>Refresh</button></div>
      <p className="hint" style={{ marginBottom: 12 }}>Each person is counted once per day (even if they open the site many times). Month, year and all-time numbers count each person once. Days follow Israel time.</p>
      {err && <p className="empty">{err}</p>}
      {st && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[['Today', st.today], ['This month', st.month], ['This year', st.year], ['All time', st.all]].map(([l, n]) => (
              <div key={l} style={BOX}><div style={{ color: 'var(--muted)', fontSize: 13 }}>{l}</div><div style={{ fontSize: 28, fontWeight: 800 }}>{Number(n).toLocaleString('en')}</div></div>
            ))}
          </div>
          <b>Last 30 days</b>
          <div style={{ marginTop: 8, marginBottom: 20 }}>
            {st.days.map((d) => (
              <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, marginBottom: 4 }}>
                <span style={{ width: 110, color: 'var(--muted)' }}>{fmtDay(d.day)}</span>
                <span style={{ height: 10, borderRadius: 5, background: 'var(--brand)', width: Math.max(2, Math.round((d.n / max) * 55)) + '%', opacity: d.n ? 1 : .25 }} />
                <b>{d.n}</b>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="tools"><b>Numbers shown to visitors</b></div>
      <p className="hint" style={{ marginBottom: 10 }}>These are the numbers on the home page (members and Verified). Leave a box empty to show the real number. Your real numbers: <b>{realMembers}</b> members, <b>{realVerified}</b> Verified.</p>
      <div className="row">
        <div className="info" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <div><label>Members shown (empty = real)</label><input className="inline-input" inputMode="numeric" placeholder={String(realMembers)} value={shownM} onChange={(e) => setShownM(e.target.value.replace(/[^0-9]/g, ''))} /></div>
          <div><label>Verified shown (empty = real)</label><input className="inline-input" inputMode="numeric" placeholder={String(realVerified)} value={shownV} onChange={(e) => setShownV(e.target.value.replace(/[^0-9]/g, ''))} /></div>
        </div>
        <div className="acts"><button className="sm good" onClick={save}>Save</button><button className="sm" onClick={reset}>Use real numbers</button></div>
      </div>
    </>
  );
}
