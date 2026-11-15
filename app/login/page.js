'use client';
import Link from 'next/link';
import { useState } from 'react';
import { configured, supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      return setMsg(/confirm/i.test(error.message) ? 'Please confirm your email first. Check your inbox for the link.' : 'Wrong email or password.');
    }
    const { data: p } = await supabase.from('profiles').select('paid,role').eq('id', data.user.id).single();
    window.location.href = p && p.role === 'admin' ? '/admin' : '/';
  };

  const reset = async () => {
    if (!email.trim()) return setMsg('Type your email above first.');
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/login' });
    setMsg('If that email has an account, a reset link is on its way.');
  };

  return (
    <div className="authcard">
      <Link className="logo" href="/" style={{ marginBottom: 20 }}>DEALORA</Link>
      <h1>Sign in</h1>
      <p>Welcome back.</p>
      {!configured && <div className="err" style={{ marginBottom: 14 }}>Site setup is incomplete: the Supabase keys were not added before the site was built. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the host settings, then redeploy.</div>}
      <form onSubmit={submit}>
        <label htmlFor="e">Email</label>
        <input id="e" type="email" required autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
        <label htmlFor="p">Password</label>
        <input id="p" type="password" required autoComplete="current-password" value={password} onChange={(ev) => setPassword(ev.target.value)} />
        {msg && <div className="err" style={{ marginTop: 14 }}>{msg}</div>}
        <button className="btn btn-solid" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="alt"><button className="linkbtn" onClick={reset}>Forgot your password?</button></div>
      <div className="alt">New here? <Link href="/signup">Join Dealora</Link></div>
    </div>
  );
}
