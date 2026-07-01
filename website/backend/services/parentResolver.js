import supabase from '../config/supabase.js';

/**
 * Maps auth user id (`children.parent_id` / JWT subject) → `parents.parent_id` row PK.
 */
export async function resolveParentRowByAuthUserId(authUserId) {
  if (authUserId == null || String(authUserId).trim() === '') return null;

  const { data, error } = await supabase
    .from('parents')
    .select('parent_id')
    .eq('user_id', String(authUserId))
    .maybeSingle();

  if (error) throw error;
  return data?.parent_id ?? null;
}

/**
 * Ensures a `public.parents` row exists for an auth user so `public.reports.parent_id`
 * FK inserts succeed. Parents who sign in via Supabase Auth may lack a profile row
 * even when they have children and screening data.
 */
export async function ensureParentRowForAuthUser(authUserId, hints = {}) {
  const authId = String(authUserId || '').trim();
  if (!authId) return null;

  const existing = await resolveParentRowByAuthUserId(authId);
  if (existing) return existing;

  const hintEmail = typeof hints.email === 'string' ? hints.email.trim() : '';
  const hintName = typeof hints.fullName === 'string' ? hints.fullName.trim() : '';

  if (hintEmail) {
    const { data: byEmail, error: emailErr } = await supabase
      .from('parents')
      .select('parent_id, user_id')
      .eq('email', hintEmail)
      .maybeSingle();
    if (emailErr) throw emailErr;
    if (byEmail?.parent_id) {
      if (!byEmail.user_id) {
        await supabase.from('parents').update({ user_id: authId }).eq('parent_id', byEmail.parent_id);
      }
      return byEmail.parent_id;
    }
  }

  let email = hintEmail;
  let fullName = hintName || 'Parent';

  try {
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(authId);
    if (!authErr && authData?.user) {
      email = email || (authData.user.email || '').trim();
      const metaName = authData.user.user_metadata?.full_name;
      if (typeof metaName === 'string' && metaName.trim()) {
        fullName = metaName.trim();
      }
    }
  } catch (_) {
    // Auth lookup is best-effort; upsert below may still succeed with hints only.
  }

  if (!email) return null;

  const { data, error } = await supabase
    .from('parents')
    .upsert(
      {
        user_id: authId,
        full_name: fullName,
        email,
        is_verified: true,
      },
      { onConflict: 'user_id' },
    )
    .select('parent_id')
    .single();

  if (error) throw error;
  return data?.parent_id ?? null;
}
