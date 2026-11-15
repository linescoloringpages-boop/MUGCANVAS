import { supabase } from './supabase';

// Records what a signed-in member does (search, code reveal/copy, link open). Fails silently.
export async function track(userId, kind, fields = {}) {
  if (!userId) return;
  try {
    await supabase.from('member_activity').insert({
      user_id: userId, kind,
      coupon_id: fields.coupon_id || null,
      store: fields.store ? String(fields.store).slice(0, 80) : null,
      detail: fields.detail ? String(fields.detail).slice(0, 120) : null,
    });
  } catch { /* ignore */ }
}
