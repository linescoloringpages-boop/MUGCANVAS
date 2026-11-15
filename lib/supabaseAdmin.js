import { createClient } from '@supabase/supabase-js';

// Server-only client with the service role key. It bypasses Row Level Security.
// Import it only from files under app/api/. Never from a 'use client' file.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'service',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const serverConfigured = !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// Identify the signed-in member from the token the browser sends.
// The public (anon) key is enough to verify a member's own token.
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'anon',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function userFromRequest(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await anon.auth.getUser(token);
  return error ? null : data.user;
}
