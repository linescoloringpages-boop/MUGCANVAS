import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest, serverConfigured } from '../../../lib/supabaseAdmin';
import { checkLink } from '../../../lib/linkcheck';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 26;

// POST { submissionId }  -> checks the link stored on that submission and saves the result.
//   Allowed for the admin (any time) and for the member who sent it (only while the check is still "pending").
// POST { url }           -> checks a link without saving. Members use it before sending a coupon (5 per hour); the admin and staff without limit.
//   The server checks again after the coupon is sent, so this first check is a convenience and a second line of defence.
// The link is always read from the database, never trusted from the browser.
export async function POST(req) {
  if (!serverConfigured) return NextResponse.json({ error: 'The link check is not set up yet: the site owner must add SUPABASE_SERVICE_ROLE_KEY in Netlify and rebuild.' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Your sign-in could not be verified. Please sign out, sign in again and retry.' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch { /* empty */ }
  const { data: me } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = !!me && me.role === 'admin';
  const isStaff = !!me && me.role === 'staff';
  let access = null;
  if (isStaff) { const a = await supabaseAdmin.from('staff_access').select('*').eq('user_id', user.id).maybeSingle(); access = a.data; }
  const inScope = (c) => !!access && (access.countries.includes('*') || access.countries.includes(c || 'WW'));

  if (body.url) {
    // Staff and the main admin can check any link. A member can check a link before sending it (limited per hour).
    const privileged = isAdmin || (access && (access.perm_coupons || access.perm_links || access.perm_approve));
    if (!privileged) {
      const since = new Date(Date.now() - 3600 * 1000).toISOString();
      const { count } = await supabaseAdmin.from('link_check_log').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
      if ((count || 0) >= 5) return NextResponse.json({ error: 'You checked many links in the last hour. Please try again later.' }, { status: 429 });
      await supabaseAdmin.from('link_check_log').insert({ user_id: user.id });
    }
    const r = await checkLink(String(body.url));
    return NextResponse.json({ status: r.status, note: r.note });
  }

  if (!body.submissionId) return NextResponse.json({ error: 'Missing submission.' }, { status: 400 });
  const { data: s } = await supabaseAdmin.from('submissions').select('id,user_id,url,status,link_check,country,coupon_id').eq('id', body.submissionId).single();
  if (!s) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const owner = s.user_id === user.id;
  let staffOk = false;
  if (access && (access.perm_approve || access.perm_links)) {
    let c = s.country;
    if (s.coupon_id) { const cp = await supabaseAdmin.from('coupons').select('country').eq('id', s.coupon_id).maybeSingle(); if (cp.data) c = cp.data.country; }
    staffOk = inScope(c);
  }
  if (!isAdmin && !staffOk && !(owner && s.link_check === 'pending')) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });

  if (!s.url) {
    await supabaseAdmin.from('submissions').update({ link_check: 'none', link_check_note: null, link_checked_url: null, link_checked_at: null }).eq('id', s.id);
    return NextResponse.json({ status: 'none', note: '' });
  }
  const r = await checkLink(s.url);
  const upd = { link_check: r.status, link_check_note: (r.note || '').slice(0, 300), link_checked_url: s.url, link_checked_at: new Date().toISOString() };
  // A link that is on a threat list never reaches the admin's queue.
  if (r.status === 'unsafe' && s.status === 'pending') { upd.status = 'rejected'; upd.reviewed_at = new Date().toISOString(); }
  await supabaseAdmin.from('submissions').update(upd).eq('id', s.id);
  return NextResponse.json({ status: r.status, note: r.note });
}
