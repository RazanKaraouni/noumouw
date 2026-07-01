import supabase from '../config/supabase.js';

// SERVICE ROLE: justified because caseload checks join children/appointments across tenants server-side.
const ACTIVE_APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancellation_requested',
];

/**
 * True when [therapistId] may send a push to an FCM token owned by [parentUserId]
 * (caseload link, active appointment, or assignment).
 */
export async function therapistCanNotifyParentUser({ therapistId, parentUserId }) {
  if (!therapistId || !parentUserId) return false;

  const { data: children, error: childrenErr } = await supabase
    .from('children')
    .select('children_id')
    .eq('parent_id', parentUserId);

  if (childrenErr) throw childrenErr;
  const childIds = (children || [])
    .map((row) => row.children_id)
    .filter((id) => id != null);

  if (childIds.length === 0) return false;

  const [linkRes, apptRes, assignRes] = await Promise.all([
    supabase
      .from('therapist_children')
      .select('id')
      .eq('therapist_id', therapistId)
      .in('child_id', childIds)
      .limit(1),
    supabase
      .from('appointments')
      .select('appointments_id')
      .eq('therapist_id', therapistId)
      .in('child_id', childIds)
      .in('status', ACTIVE_APPOINTMENT_STATUSES)
      .limit(1),
    supabase
      .from('assignments')
      .select('assignment_id')
      .eq('therapist_id', therapistId)
      .in('child_id', childIds)
      .limit(1),
  ]);

  if (linkRes.error) throw linkRes.error;
  if (apptRes.error) throw apptRes.error;
  if (assignRes.error) throw assignRes.error;

  return Boolean(
    (linkRes.data || []).length ||
      (apptRes.data || []).length ||
      (assignRes.data || []).length,
  );
}

/** Resolve auth.users id for an FCM device token row. */
export async function resolveParentUserIdForDeviceToken(token) {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle();

  if (error) throw error;
  return data?.user_id ? String(data.user_id) : null;
}
