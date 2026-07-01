import { createClient } from '@supabase/supabase-js';

/**
 * User-scoped Supabase client (anon key + parent/portal JWT).
 * Enforces Postgres RLS for parent data access.
 */
export function createUserSupabase(userJwt) {
  const token = String(userJwt || '').trim();
  if (!token) {
    throw new Error('User JWT is required for user-scoped Supabase client.');
  }

  const url = process.env.SUPABASE_URL || '';
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set.');
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
