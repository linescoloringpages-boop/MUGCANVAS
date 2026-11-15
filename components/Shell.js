'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TERMS_HTML, TERMS_VERSION } from '../lib/termsHtml';

const Mark = () => (
  <span className="logo-mark">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    </svg>
  </span>
);

// Hidden shortcut: typing JOY three times in a row (JOYJOYJOY, any letter case, no pause longer than 3 seconds
// between keys) reveals an Admin button. It only reveals the button; the admin area itself is protected by the
// admin account (login + role in the database), not by this word.
const SECRET = 'joyjoyjoy';
function useAdminReveal() {
  const [shown, setShown] = useState(false);
  const buf = useRef({ text: '', last: 0 });
  useEffect(() => {
    try { if (sessionStorage.getItem('dealora_admin_btn') === '1') setShown(true); } catch { /* ignore */ }
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
      const now = Date.now();
      if (now - buf.current.last > 3000) buf.current.text = '';
      buf.current.last = now;
      buf.current.text = (buf.current.text + e.key.toLowerCase()).slice(-SECRET.length);
      if (buf.current.text === SECRET) {
        setShown(true);
        try { sessionStorage.setItem('dealora_admin_btn', '1'); } catch { /* ignore */ }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return shown;
}

// Counts each visitor once per day (a random id kept in the browser, no name or email). Fails silently.
function useVisitCounter() {
  useEffect(() => {
    try {
      let id = localStorage.getItem('dealora_vid');
      if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''); localStorage.setItem('dealora_vid', id); }
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem('dealora_vday') === today) return;
      localStorage.setItem('dealora_vday', today);
      supabase.rpc('record_visit', { v: id }).then(() => {}, () => {});
    } catch { /* ignore */ }
  }, []);
}

export function Header({ auth }) {
  useVisitCounter();
  const [open, setOpen] = useState(false);
  const adminBtn = useAdminReveal();
  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/'; };
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link className="logo" href="/" aria-label="Dealora home"><Mark />DEALORA</Link>
        <nav className={'nav-links' + (open ? ' open' : '')} aria-label="Main" onClick={() => setOpen(false)}>
          <Link href="/">Home</Link>
          <Link href="/#categories">Categories</Link>
          <Link href="/#deals">Deals</Link>
          <Link href="/#stores">Stores</Link>
          <Link href="/#how">How It Works</Link>
          {(auth.admin || auth.staff) && <Link href="/admin">Admin</Link>}
        </nav>
        <div className="nav-actions">
          {adminBtn && !auth.admin && !auth.staff && <Link className="btn btn-ghost signin" href={auth.user ? '/admin' : '/login'}>Admin</Link>}
          {auth.user ? (
            <>
              <Link className="btn btn-ghost signin" href="/account">Account</Link>
              {auth.paid ? <Link className="btn btn-solid" href="/for-you">For you</Link> : <Link className="btn btn-solid" href="/join">Get Verified</Link>}
              <button className="btn btn-ghost signin" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost signin" href="/login">Sign In</Link>
              <Link className="btn btn-solid" href="/signup">Join Dealora</Link>
            </>
          )}
          <button className="menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer({ onTerms }) {
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <div>
            <div className="logo"><Mark />DEALORA</div>
            <p>Your Deals. Your Savings.</p>
          </div>
          <nav className="flinks" aria-label="Footer">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/rules">Community Rules</Link>
            <Link href="/affiliate">Affiliate Disclosure</Link>
            {onTerms ? <a href="#" onClick={(e) => { e.preventDefault(); onTerms(); }}>Link Submission Terms</a> : <Link href="/terms#links">Link Submission Terms</Link>}
            <Link href="/contact">Report a Problem</Link>
          </nav>
        </div>
        <p className="legal">
          Dealora may earn a commission when you use some links. Community deals are submitted by members and approved by the Dealora team; they are not verified unless labeled Verified.
        </p>
      </div>
    </footer>
  );
}

export function TermsDialog({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Link Submission Terms" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Link Submission Terms</h3>
        <p>Version {TERMS_VERSION}. Please read before adding a link.</p>
        <div className="terms-txt" tabIndex={0} dangerouslySetInnerHTML={{ __html: TERMS_HTML }} />
        <div className="dlg-actions"><button type="button" className="btn btn-solid" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
