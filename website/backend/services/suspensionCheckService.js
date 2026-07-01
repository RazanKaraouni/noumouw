import supabase from '../config/supabase.js';

/**
 * Returns true when the authenticated therapist or parent account is suspended.
 * Admins are not subject to is_suspended checks.
 *
 * @param {{ role?: string, therapistId?: string, parentUserId?: string }} auth
 */
export async function isAccountSuspended(auth) {
  const role = String(auth?.role || '').toLowerCase();

  if (role === 'therapist' && auth?.therapistId) {
    const { data, error } = await supabase
      .from('therapists')
      .select('is_suspended')
      .eq('therapist_id', auth.therapistId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.is_suspended);
  }

  if (role === 'parent' && auth?.parentUserId) {
    const { data, error } = await supabase
      .from('parents')
      .select('is_suspended')
      .eq('user_id', auth.parentUserId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.is_suspended);
  }

  return false;
}
