import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';
import { createUserSupabase } from '../config/supabaseUser.js';
import { parseBearerToken } from '../middleware/auth.js';

/** SERVICE ROLE: default server client — admin, auth.admin, cascades, RLS bypass. */
export function getServiceSupabase() {
  return supabase;
}

function isAppIssuedParentJwt(token) {
  if (!process.env.JWT_SECRET) return false;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return String(decoded?.role || '').toLowerCase() === 'parent';
  } catch {
    return false;
  }
}

/**
 * Parent routes: Supabase session + anon key so RLS applies.
 * App-issued parent JWTs fall back to service role (ownership enforced in controllers).
 */
export function getParentSupabase(req) {
  const role = String(req?.auth?.role || '').toLowerCase();
  const token = req?.accessToken || parseBearerToken(req);
  if (role !== 'parent' || !token) {
    return supabase;
  }
  if (isAppIssuedParentJwt(token)) {
    return supabase;
  }
  return createUserSupabase(token);
}
