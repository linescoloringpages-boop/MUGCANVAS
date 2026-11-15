import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest, serverConfigured } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST { userId, reason }  (main admin only)
// Removes a member for bad behaviour: remembers the email so it cannot join again, then deletes the account.
// Deleting the account also deletes what the member posted (replies, votes, shared coupons, reviews).
export async function POST(req) {
  if (!serverConfigured) return NextResponse.json({ error: 'The server is not set up yet (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Your sign-in could not be verified. Please sign in again.' }, { status: 401 });
  const { data: me } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Only the main admin can remove a member.' }, { status: 403 });

  let body = {};
  try { body = await req.json(); } catch { /* empty */ }
  const userId = String(body.userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: 'Missing member.' }, { status: 400 });
  if (userId === user.id) return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 });
  const { data: target } = await supabaseAdmin.from('profiles').select('id,email,role').eq('id', userId).maybeSingle();
  if (!target) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  if (target.role === 'admin' || target.role === 'staff') return NextResponse.json({ error: 'Admins and staff cannot be removed here. Remove their staff access first.' }, { status: 400 });

  const reason = String(body.reason || '').slice(0, 300) || null;
  const b = await supabaseAdmin.from('removed_members').upsert({ email: String(target.email).toLowerCase(), reason }, { onConflict: 'email' });
  if (b.error) return NextResponse.json({ error: 'Could not record the removal.' }, { status: 500 });
  const d = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (d.error) return NextResponse.json({ error: 'Could not delete the account: ' + d.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
