'use client';
import Link from 'next/link';
import { useState } from 'react';
import { configured, supabase } from '../../lib/supabase';
import { cname, guessLoc, sortedCountries } from '../../lib/regions';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState(() => { const g = guessLoc(); return g && g !== 'WW' ? g : ''; });
  const [username, setUsername] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [magazine, setMagazine] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg({ type: '', text: '' });
    const un = username.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(un)) { setBusy(false); return setMsg({ type: 'err', text: 'Username: 3 to 20 letters, numbers or underscores.' }); }
    if (!agree) { setBusy(false); return setMsg({ type: 'err', text: 'Please confirm that you accept the Terms, the Privacy Policy and the Community Rules.' }); }
    const { data: free, error: ue } = await supabase.rpc('username_available', { u: un });
    if (ue) { setBusy(false); return setMsg({ type: 'err', text: 'Could not check the username. Please try again.' }); }
    if (!free) { setBusy(false); return setMsg({ type: 'err', text: 'That username is taken or not allowed. Please choose another.' }); }
    const { error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { marketing, magazine, country, username: un, accepted_terms: '2026-11-14' }, emailRedirectTo: window.location.origin + '/' },
    });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: /database error/i.test(error.message) ? 'This email address cannot be used to join Dealora. If you think this is a mistake, please contact us.' : error.message });
    setMsg({ type: 'ok', text: 'Almost done. We sent a confirmation link to your email. Open it to confirm your address, then sign in.' });
  };

  return (
    <div className="authcard">
      <Link className="logo" href="/" style={{ marginBottom: 20 }}>DEALORA</Link>
      <h1>Join Dealora</h1>
      <p>Sign up free with your email to see coupon codes and store links, share coupons and write reviews.</p>
      {!configured && <div className="err" style={{ marginBottom: 14 }}>Site setup is incomplete: the Supabase keys were not added before the site was built. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the host settings, then redeploy.</div>}
      <form onSubmit={submit}>
        <label htmlFor="u">Choose a username</label>
        <input id="u" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" value={username} onChange={(ev) => setUsername(ev.target.value)} />
        <p className="hint">Shown publicly next to coupons and reviews you share. Letters, numbers and underscores, 3 to 20 characters. Please do not use your email or full name.</p>
        <label htmlFor="e">Email</label>
        <input id="e" type="email" required autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
        <label htmlFor="p">Password (at least 8 characters)</label>
        <input id="p" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(ev) => setPassword(ev.target.value)} />
        <label htmlFor="c">Country where you live</label>
        <select id="c" required value={country} onChange={(ev) => setCountry(ev.target.value)}>
          <option value="">Select your country</option>
          {sortedCountries().map((c) => <option key={c} value={c}>{cname(c)}</option>)}
        </select>
        <p className="hint">We use it to show you deals that apply where you live.</p>
        <p className="hint" style={{ margin: '16px 0 0' }}>Your choices about email. Both are optional and off unless you tick them.</p>
        <label className="optin">
          <input type="checkbox" checked={marketing} onChange={(ev) => setMarketing(ev.target.checked)} />
          <span>Send me marketing emails: deals, offers and news from Dealora.</span>
        </label>
        <label className="optin">
          <input type="checkbox" checked={magazine} onChange={(ev) => setMagazine(ev.target.checked)} />
          <span>Send me the monthly Dealora magazine with the best coupons of the month.</span>
        </label>
        <p className="hint">You can change these at any time in your account, and every email has an unsubscribe link.</p>
        <p className="hint">To improve the deals we show, Dealora records what you search for and which coupons you open or copy while you are signed in. See the <Link href="/privacy">Privacy page</Link>.</p>
        <label className="optin">
          <input type="checkbox" required checked={agree} onChange={(ev) => setAgree(ev.target.checked)} />
          <span>I am at least 16 years old and I accept the <Link href="/terms" target="_blank">Terms of Use</Link>, the <Link href="/privacy" target="_blank">Privacy Policy</Link> and the <Link href="/rules" target="_blank">Community Rules</Link>.</span>
        </label>
        {msg.text && <div className={msg.type === 'ok' ? 'dlg-msg' : 'err'} style={{ marginTop: 14 }}>{msg.text}</div>}
        <button className="btn btn-solid" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create free account'}</button>
      </form>
      <div className="alt">Already a member? <Link href="/login">Sign in</Link></div>
    </div>
  );
}
