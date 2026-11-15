import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest, serverConfigured } from '../../../../lib/supabaseAdmin';
import { renderMagazine } from '../../../../lib/magazineEmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DAY = 86400000;
const FIRST_AFTER_DAYS = 2;   // first magazine: 2 days after signing up
const EVERY_DAYS = 30;        // then every 30 days

// POST { action: 'test' | 'run' }
//  - 'test': the main admin sends the latest published issue (or the draft) to their own email.
//  - 'run':  sends the latest PUBLISHED issue to every member whose turn it is. Called every day by the
//            scheduled function (header x-cron-secret) or by the main admin with the button.
export async function POST(req) {
  if (!serverConfigured) return NextResponse.json({ error: 'The server is not set up yet (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  let body = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = body.action === 'test' ? 'test' : 'run';

  const secret = process.env.CRON_SECRET;
  const viaCron = !!secret && req.headers.get('x-cron-secret') === secret;
  let admin = null;
  if (!viaCron) {
    const user = await userFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Your sign-in could not be verified. Please sign in again.' }, { status: 401 });
    const { data: me } = await supabaseAdmin.from('profiles').select('role,email').eq('id', user.id).single();
    if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Only the main admin can send the magazine.' }, { status: 403 });
    admin = me;
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return NextResponse.json({ error: 'Email sending is not set up yet. In Netlify add RESEND_API_KEY and MAIL_FROM (see the setup guide), then deploy again.' }, { status: 503 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || '').replace(/\/$/, '');
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  const q = supabaseAdmin.from('magazine_issues').select('*');
  const { data: issue } = action === 'test'
    ? await q.order('updated_at', { ascending: false }).limit(1).maybeSingle()
    : await q.eq('status', 'published').order('published_at', { ascending: false }).limit(1).maybeSingle();
  if (!issue) return NextResponse.json({ error: action === 'test' ? 'There is no issue yet. Build one first.' : 'There is no published issue yet. Publish one first.' }, { status: 400 });
  if (!Array.isArray(issue.items) || !issue.items.length) return NextResponse.json({ error: 'The issue has no coupons in it.' }, { status: 400 });

  const { html, text } = renderMagazine({ title: issue.title, intro: issue.intro, items: issue.items, siteUrl, supabaseUrl: supaUrl, issueDate: issue.published_at || new Date() });
  const subject = `${issue.title} - ${new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}`;
  const headers = siteUrl ? { 'List-Unsubscribe': `<${siteUrl}/account>` } : undefined;

  const sendBatch = async (emails) => {
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(emails.map((to) => ({ from, to: [to], subject: action === 'test' ? '[TEST] ' + subject : subject, html, text, headers }))),
    });
    if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch { /* ignore */ } throw new Error(`Email service answered ${r.status}${m ? ': ' + m : ''}`); }
  };

  if (action === 'test') {
    try { await sendBatch([admin.email]); } catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }); }
    return NextResponse.json({ ok: true, sent: 1, to: admin.email });
  }

  // Who is due: opted in, and (never sent and joined 2+ days ago) or (last sent 30+ days ago).
  const now = Date.now();
  const { data: people, error } = await supabaseAdmin.from('profiles').select('id,email,created_at,magazine_last_sent_at').eq('magazine', true).neq('role', 'admin');
  if (error) return NextResponse.json({ error: 'Could not read the member list.' }, { status: 500 });
  const due = (people || []).filter((p) => p.email && (p.magazine_last_sent_at
    ? now - new Date(p.magazine_last_sent_at).getTime() >= EVERY_DAYS * DAY
    : now - new Date(p.created_at).getTime() >= FIRST_AFTER_DAYS * DAY))
    .sort((a, b) => new Date(a.magazine_last_sent_at || a.created_at) - new Date(b.magazine_last_sent_at || b.created_at));
  const limit = Math.max(1, Math.min(parseInt(process.env.MAGAZINE_BATCH || '90', 10) || 90, 500));
  const todo = due.slice(0, limit);

  let sent = 0; let failed = '';
  for (let i = 0; i < todo.length; i += 50) {
    const chunk = todo.slice(i, i + 50);
    try {
      await sendBatch(chunk.map((p) => p.email));
      await supabaseAdmin.from('profiles').update({ magazine_last_sent_at: new Date().toISOString() }).in('id', chunk.map((p) => p.id));
      sent += chunk.length;
    } catch (e) { failed = e.message; break; }
  }
  return NextResponse.json({ ok: !failed, sent, waiting: due.length - sent, error: failed || undefined });
}
