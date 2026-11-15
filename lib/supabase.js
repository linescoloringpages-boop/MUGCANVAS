import { createClient } from '@supabase/supabase-js';

// Browser client. Uses the public anon key. What it may read or write is decided by the
// Row Level Security rules in supabase/schema.sql, not by this code.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon'
);

// false when the Supabase keys were not set when the site was built (sign-up then fails with "Failed to fetch").
export const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
