'use client';
import Link from 'next/link';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import InterestsForm, { EMPTY_INTERESTS } from '../../components/InterestsForm';

const PRICE = process.env.NEXT_PUBLIC_PRICE || '1.99';
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'USD';

export default function Join() {
  const auth = useAuth();
  const [stage, setStage] = useState('form'); // form -> pay
  const [interests, setInterests] = useState(EMPTY_INTERESTS);
  const [marketing, setMarketing] = useState(false);
  const [magazine, setMagazine] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.profile) {
      setInterests({ ...EMPTY_INTERESTS, ...(auth.profile.interests || {}) });
      setMarketing(!!auth.profile.marketing);
      setMagazine(!!auth.profile.magazine);
    }
  }, [auth.profile]);

  if (auth.loading) return <div className="authcard"><p>Loading…</p></div>;

  if (!auth.user) {
    return (
      <div className="authcard">
        <h1>Become a Verified User</h1>
        <p>Create your free account first. Then you can upgrade for a one-time payment.</p>
        <Link className="btn btn-solid" href="/signup">Create free account</Link>
        <div className="alt">Already a member? <Link href="/login">Sign in</Link></div>
      </div>
    );
  }

  if (auth.paid) {
    return (
      <div className="authcard">
        <h1>You are a Verified User</h1>
        <p>Your membership is active for good. You get deal emails first, the monthly magazine (if you chose it) and your own page of the best coupons for you.</p>
        <Link className="btn btn-solid" href="/for-you">Open my page</Link>
        <div className="alt"><Link href="/account">Edit my interests and email choices</Link></div>
      </div>
    );
  }

  const saveAndContinue = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg({ type: '', text: '' });
    const p = auth.profile || {};
    const now = new Date().toISOString();
    const { error } = await supabase.from('profiles').update({
      interests,
      marketing, marketing_consent_at: marketing ? (p.marketing ? p.marketing_consent_at || now : now) : null,
      magazine, magazine_consent_at: magazine ? (p.magazine ? p.magazine_consent_at || now : now) : null,
    }).eq('id', auth.user.id);
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: 'Could not save your answers. Please try again.' });
    await auth.refresh();
    setStage('pay');
  };

  const authHeader = () => ({ Authorization: 'Bearer ' + auth.session.access_token, 'Content-Type': 'application/json' });

  return (
    <div className="authcard" style={{ maxWidth: 560 }}>
      <Link className="logo" href="/" style={{ marginBottom: 20 }}>DEALORA</Link>
      <h1>Become a Verified User</h1>
      <div className="price">{CURRENCY === 'USD' ? '$' : ''}{PRICE}{CURRENCY === 'USD' ? '' : ' ' + CURRENCY}</div>
      <p>One-time payment, for good. No subscription.</p>
      <ul className="perks">
        <li>Everything a free member gets: coupon codes, store links, sharing coupons and reviews</li>
        <li>A <b>Verified User</b> badge on what you share</li>
        <li><b>Personalized</b> new coupons and deals by email, <b>first and in real time</b></li>
        <li>Your own page, updated with the coupons that suit you best and available at all times</li>
        <li>The monthly Dealora magazine (if you choose it below)</li>
      </ul>

      {stage === 'form' ? (
        <form onSubmit={saveAndContinue}>
          <h3 style={{ margin: '8px 0 4px' }}>Tell us what you use coupons for</h3>
          <p className="hint">We use your answers to prepare your personal page.</p>
          <InterestsForm value={interests} onChange={setInterests} />

          <h3 style={{ margin: '20px 0 4px' }}>Your email choices</h3>
          <label className="optin">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>Send me marketing emails: deals, offers and news from Dealora.</span>
          </label>
          <label className="optin">
            <input type="checkbox" checked={magazine} onChange={(e) => setMagazine(e.target.checked)} />
            <span>Send me the monthly Dealora magazine.</span>
          </label>
          <p className="hint" style={{ marginTop: 12 }}>Real-time deal emails and your personal page are part of what you pay for, so there is nothing to tick for them. You can pause the real-time emails at any time in your account, and every email has an unsubscribe link.</p>
          {msg.text && <div className="err">{msg.text}</div>}
          <button className="btn btn-solid" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Continue to payment'}</button>
        </form>
      ) : (
        <>
          {msg.text && <div className={msg.type === 'ok' ? 'dlg-msg' : 'err'} style={{ marginBottom: 14 }}>{msg.text}</div>}
          <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test', currency: CURRENCY, intent: 'capture' }}>
            <PayPalButtons
              style={{ layout: 'vertical', shape: 'rect' }}
              createOrder={async () => {
                setMsg({ type: '', text: '' });
                const r = await fetch('/api/paypal/create-order', { method: 'POST', headers: authHeader() });
                const j = await r.json();
                if (!r.ok) { setMsg({ type: 'err', text: j.error || 'Could not start the payment.' }); throw new Error(j.error); }
                return j.id;
              }}
              onApprove={async (data) => {
                const r = await fetch('/api/paypal/capture-order', { method: 'POST', headers: authHeader(), body: JSON.stringify({ orderID: data.orderID }) });
                const j = await r.json();
                if (!r.ok) return setMsg({ type: 'err', text: j.error || 'Payment could not be completed.' });
                setMsg({ type: 'ok', text: 'Payment received. You are now a Verified User.' });
                await auth.refresh();
              }}
              onError={() => setMsg({ type: 'err', text: 'Something went wrong with the payment. You are charged only if PayPal confirmed it.' })}
            />
          </PayPalScriptProvider>
          <div className="alt">By paying you agree to receive real-time deal emails and to have your own personal page. The payment is handled by PayPal. Dealora never sees your card details.</div>
          <div className="alt"><button className="linkbtn" onClick={() => setStage('form')}>Back to my answers</button></div>
        </>
      )}
    </div>
  );
}
