import supabase from '../config/supabase.js';

/**
 * Remove a child and all dependent rows (milestones, screenings, caseload,
 * assignments, appointments, reports, etc.). Used by admin API; parents can
 * call the matching Postgres RPC `delete_child_and_related`.
 */
export async function deleteChildAndRelated(childrenId, { parentId = null } = {}) {
  const childId = Number(childrenId);
  if (!Number.isFinite(childId) || !Number.isInteger(childId)) {
    throw new Error('Invalid children_id.');
  }

  let childQuery = supabase
    .from('children')
    .select('children_id, parent_id, profile_image_url')
    .eq('children_id', childId);
  if (parentId) {
    childQuery = childQuery.eq('parent_id', parentId);
  }
  const { data: child, error: childErr } = await childQuery.maybeSingle();
  if (childErr) throw childErr;
  if (!child) {
    const err = new Error('Child not found.');
    err.status = 404;
    throw err;
  }

  const { data: appointments, error: apptListErr } = await supabase
    .from('appointments')
    .select('appointments_id')
    .eq('child_id', childId);
  if (apptListErr) throw apptListErr;

  const appointmentIds = (appointments || [])
    .map((a) => a.appointments_id)
    .filter(Boolean);

  const del = async (table, column, value) => {
    const { error } = await supabase.from(table).delete().eq(column, value);
    if (error) throw error;
  };

  const delIn = async (table, column, values) => {
    if (!values?.length) return;
    const { error } = await supabase.from(table).delete().in(column, values);
    if (error) throw error;
  };

  await del('assignments', 'child_id', childId);
  await del('therapist_children', 'child_id', childId);
  await del('child_milestones', 'child_id', childId);
  await del('screening_results', 'child_id', childId);
  await del('reports', 'child_id', childId);
  await del('therapist_private_notes', 'child_id', childId);
  await del('messages', 'child_id', childId);
  await delIn('notifications', 'appointment_id', appointmentIds);
  await delIn('therapist_private_notes', 'appointment_id', appointmentIds);
  await delIn('payments', 'appointment_id', appointmentIds);
  await del('appointments', 'child_id', childId);
  await del('payments', 'child_id', childId);

  const { error: deleteErr } = await supabase
    .from('children')
    .delete()
    .eq('children_id', childId);
  if (deleteErr) throw deleteErr;

  return { children_id: childId, deleted: true };
}
