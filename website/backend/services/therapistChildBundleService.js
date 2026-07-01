import supabase from '../config/supabase.js';
import { loadMergedMilestonesForChild } from './childMilestoneProgressService.js';
import { loadScreeningResultsForChildId } from './screeningResultsService.js';
import {
  ageLabelFromDateOfBirth,
  ageMonthsFromDateOfBirth,
} from '../utils/childAge.js';
import { attachSignedChildProfileUrl } from '../utils/childProfileSignedUrl.js';

const CHILD_SELECT =
  'children_id, full_name, date_of_birth, gender, notes, profile_image_url, parent_id';

async function loadReportsForChild(childId) {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('child_id', childId)
    .in('report_type', ['screening_summary', 'milestone_tracking'])
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) {
    console.warn('therapist child reports load skipped:', error.message);
    return [];
  }
  return data || [];
}

async function loadNotesForChild({ therapistId, childId, appointmentIds }) {
  const byId = new Map();
  const addRows = (rows) => {
    for (const row of rows || []) {
      if (row?.therapist_private_note_id) {
        byId.set(row.therapist_private_note_id, row);
      }
    }
  };

  const q1 = await supabase
    .from('therapist_private_notes')
    .select(
      'therapist_private_note_id, note, appointment_id, child_id, created_at, updated_at',
    )
    .eq('therapist_id', therapistId)
    .eq('child_id', childId);
  if (q1.error) throw q1.error;
  addRows(q1.data);

  if (appointmentIds?.length) {
    const q2 = await supabase
      .from('therapist_private_notes')
      .select(
        'therapist_private_note_id, note, appointment_id, child_id, created_at, updated_at',
      )
      .eq('therapist_id', therapistId)
      .in('appointment_id', appointmentIds);
    if (q2.error) throw q2.error;
    addRows(q2.data);
  }

  return [...byId.values()].sort((a, b) =>
    String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)),
  );
}

/** Therapist has caseload row or a non-cancelled appointment with this child. */
export async function therapistCanAccessChild({ therapistId, childId }) {
  const [linkRes, apptRes] = await Promise.all([
    supabase
      .from('therapist_children')
      .select('id')
      .eq('therapist_id', therapistId)
      .eq('child_id', childId)
      .maybeSingle(),
    supabase
      .from('appointments')
      .select('appointments_id, status')
      .eq('therapist_id', therapistId)
      .eq('child_id', childId)
      .in('status', ['pending', 'confirmed', 'completed', 'cancellation_requested'])
      .limit(1),
  ]);
  if (linkRes.error) throw linkRes.error;
  if (apptRes.error) throw apptRes.error;
  return Boolean(linkRes.data || (apptRes.data || []).length);
}

export async function therapistHasCompletedSession({ therapistId, childId }) {
  const { data, error } = await supabase
    .from('appointments')
    .select('appointments_id')
    .eq('therapist_id', therapistId)
    .eq('child_id', childId)
    .eq('status', 'completed')
    .limit(1);
  if (error) throw error;
  return Boolean((data || []).length);
}

/**
 * Full child clinical bundle for therapist review (pre- or post-caseload).
 */
export async function loadTherapistChildBundle({
  therapistId,
  childId,
  link = null,
  appointmentContext = null,
}) {
  const numericChildId = Number(childId);
  if (!Number.isFinite(numericChildId)) {
    const err = new Error('Invalid child id.');
    err.status = 400;
    throw err;
  }

  const canAccess = await therapistCanAccessChild({ therapistId, childId: numericChildId });
  if (!canAccess) {
    const err = new Error('You do not have access to this child.');
    err.status = 403;
    throw err;
  }

  let resolvedLink = link;
  if (!resolvedLink) {
    const linkRes = await supabase
      .from('therapist_children')
      .select('id, therapist_id, child_id, parent_id, appointment_id, assigned_at')
      .eq('therapist_id', therapistId)
      .eq('child_id', numericChildId)
      .maybeSingle();
    if (linkRes.error) throw linkRes.error;
    resolvedLink = linkRes.data;
  }

  const parentIdFromLink = resolvedLink?.parent_id;

  const [childRes, assignmentsRes, appointmentsRes, reports, screening_results] =
    await Promise.all([
      supabase
        .from('children')
        .select(CHILD_SELECT)
        .eq('children_id', numericChildId)
        .maybeSingle(),
      supabase
        .from('assignments')
        .select(
          'assignment_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at',
        )
        .eq('therapist_id', therapistId)
        .eq('child_id', numericChildId)
        .order('created_at', { ascending: false }),
      supabase
        .from('appointments')
        .select(
          'appointments_id, appointment_date, status, notes, created_at, availability:availability_id(start_time, end_time)',
        )
        .eq('therapist_id', therapistId)
        .eq('child_id', numericChildId)
        .order('appointment_date', { ascending: false })
        .limit(80),
      loadReportsForChild(numericChildId),
      loadScreeningResultsForChildId(numericChildId),
    ]);

  if (childRes.error) throw childRes.error;
  if (!childRes.data) {
    const err = new Error('Child not found.');
    err.status = 404;
    throw err;
  }
  if (assignmentsRes.error) throw assignmentsRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;

  const parentId = parentIdFromLink || childRes.data.parent_id;
  let parent = null;
  if (parentId) {
    const parentRes = await supabase
      .from('parents')
      .select('parent_id, user_id, full_name, email, address')
      .eq('parent_id', parentId)
      .maybeSingle();
    if (parentRes.error) throw parentRes.error;
    parent = parentRes.data;
  }

  const childRow = childRes.data;
  const { milestones } = await loadMergedMilestonesForChild(
    numericChildId,
    childRow?.date_of_birth,
  );

  const apptRows = appointmentsRes.data || [];
  const apptIds = apptRows.map((a) => a.appointments_id).filter(Boolean);
  const therapist_private_notes = await loadNotesForChild({
    therapistId,
    childId: numericChildId,
    appointmentIds: apptIds,
  });

  const dob = childRow?.date_of_birth ?? null;
  const hasCompletedSession = await therapistHasCompletedSession({
    therapistId,
    childId: numericChildId,
  });

  const milestoneTotal = milestones.length;
  const milestoneDone = milestones.filter((m) => m.is_completed).length;
  const latestScreen = screening_results[0] || null;

  return {
    link: resolvedLink,
    access_mode: resolvedLink ? 'caseload' : 'appointment',
    is_first_session: !hasCompletedSession,
    appointment_context: appointmentContext,
    child: await attachSignedChildProfileUrl({
      ...childRow,
      age_months: ageMonthsFromDateOfBirth(dob),
      age_label: ageLabelFromDateOfBirth(dob),
    }),
    parent,
    milestones,
    milestone_summary: {
      total: milestoneTotal,
      completed: milestoneDone,
      percent: milestoneTotal ? Math.round((milestoneDone / milestoneTotal) * 100) : 0,
    },
    screening_results,
    latest_screening: latestScreen,
    reports,
    assignments: assignmentsRes.data || [],
    appointments: apptRows.map((a) => ({
      appointments_id: a.appointments_id,
      appointment_date: a.appointment_date,
      status: a.status,
      notes: a.notes,
      start_time: a.availability?.start_time ?? null,
      end_time: a.availability?.end_time ?? null,
      created_at: a.created_at,
    })),
    therapist_private_notes,
  };
}
