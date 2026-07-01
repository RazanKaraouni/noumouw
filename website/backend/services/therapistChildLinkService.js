import supabase from '../config/supabase.js';

/**
 * Links a child to the therapist caseload (therapist_children).
 * Idempotent via unique (therapist_id, child_id). Called on appointment confirm and session complete.
 */
export async function upsertTherapistChildLink({
  therapistId,
  appointmentsId,
  userId,
  childId,
}) {
  if (childId == null || !userId) return;
  const parentRow = await supabase
    .from('parents')
    .select('parent_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (parentRow.error) throw parentRow.error;
  const parentId = parentRow.data?.parent_id;
  if (!parentId) return;

  const linkRes = await supabase.from('therapist_children').upsert(
    {
      therapist_id: therapistId,
      child_id: childId,
      parent_id: parentId,
      appointment_id: appointmentsId,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: 'therapist_id,child_id' },
  );
  if (linkRes.error) {
    console.error('therapist_children upsert failed:', linkRes.error.message || linkRes.error);
  }
}

/**
 * Backfill caseload rows for confirmed/completed appointments (one bulk pass).
 * Used only when the therapist has no caseload links yet.
 */
export async function syncAppointmentChildLinksBatched(therapistId) {
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('appointments_id, user_id, child_id')
    .eq('therapist_id', therapistId)
    .in('status', ['confirmed', 'completed'])
    .not('child_id', 'is', null);
  if (error) throw error;
  if (!appointments?.length) return;

  const userIds = [...new Set(appointments.map((a) => a.user_id).filter(Boolean))];
  if (!userIds.length) return;

  const { data: parents, error: parentErr } = await supabase
    .from('parents')
    .select('parent_id, user_id')
    .in('user_id', userIds);
  if (parentErr) throw parentErr;

  const parentByUserId = new Map((parents || []).map((p) => [p.user_id, p.parent_id]));
  const now = new Date().toISOString();
  const rows = [];
  const seen = new Set();

  for (const appt of appointments) {
    if (appt.child_id == null || !appt.user_id) continue;
    const parentId = parentByUserId.get(appt.user_id);
    if (!parentId) continue;
    const key = `${therapistId}:${appt.child_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      therapist_id: therapistId,
      child_id: appt.child_id,
      parent_id: parentId,
      appointment_id: appt.appointments_id,
      assigned_at: now,
    });
  }

  if (!rows.length) return;

  const linkRes = await supabase.from('therapist_children').upsert(rows, {
    onConflict: 'therapist_id,child_id',
  });
  if (linkRes.error) {
    console.error('therapist_children bulk upsert failed:', linkRes.error.message || linkRes.error);
  }
}
