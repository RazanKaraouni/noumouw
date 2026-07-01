import supabase from '../config/supabase.js';

export function normalizeBlocklistEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function isEmailBlocklisted(email) {
  const normalized = normalizeBlocklistEmail(email);
  if (!normalized) return false;

  const { data, error } = await supabase
    .from('email_blocklist')
    .select('block_id')
    .eq('email', normalized)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

/** Remove a reactivated account from the permanent email blocklist. */
export async function removeEmailFromBlocklist(email) {
  const normalized = normalizeBlocklistEmail(email);
  if (!normalized) return false;

  const { data, error } = await supabase
    .from('email_blocklist')
    .delete()
    .eq('email', normalized)
    .select('block_id')
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

function emailFromRequest(req) {
  return req.auth?.email || '';
}

/**
 * Runs after JWT / Supabase auth. Blocks permanently suspended identities.
 */
export default async function blocklistGuard(req, res, next) {
  try {
    const email = normalizeBlocklistEmail(emailFromRequest(req));
    if (!email) return next();

    const { data, error } = await supabase
      .from('email_blocklist')
      .select('block_id, reason')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return res.status(403).json({
        error: 'Account permanently suspended.',
        message: 'Your account has been suspended. Please sign out.',
        reason: data.reason || null,
      });
    }

    return next();
  } catch (err) {
    console.error('[blocklistGuard]', err);
    return res.status(500).json({ error: err.message });
  }
}
