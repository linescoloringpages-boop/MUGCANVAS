'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// Current session + member profile. `paid` is true for paid members and admins.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [access, setAccess] = useState(null); // limits of a staff admin (null for everyone else)
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s) => {
    if (!s) { setProfile(null); setAccess(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).single();
    setProfile(data || null);
    if (data && data.role === 'staff') {
      const a = await supabase.from('staff_access').select('*').eq('user_id', s.user.id).maybeSingle();
      setAccess(a.data || { countries: [] });
    } else setAccess(null);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await load(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Do not call supabase from inside this callback directly. Defer it.
      setTimeout(() => load(s), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [load]);

  return {
    session,
    user: session ? session.user : null,
    profile,
    loading,
    refresh: () => load(session),
    paid: !!(profile && (profile.paid || profile.role === 'admin')),
    admin: !!(profile && profile.role === 'admin'),
    staff: !!(profile && profile.role === 'staff'),
    access,
  };
}
