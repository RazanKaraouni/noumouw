import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import supabase from '../config/supabase.js';

const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'cancellation_requested',
];

function calculateAgeInMonths(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return months < 0 ? 0 : months;
}

function formatChildAge(dateOfBirth) {
  const months = calculateAgeInMonths(dateOfBirth);
  if (months == null) return null;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0) return rem > 0 ? `${years}y ${rem}m` : `${years}y`;
  return `${months}m`;
}

function childNameFromNotes(notes) {
  const m = String(notes ?? '').match(/Child for appointment:\s*(.+?)\s*\(/);
  return m ? m[1].trim() : '';
}

const CANCELLED_STATUSES = ['cancelled', 'canceled'];

function normalizeParentEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return normalized || null;
}

/** Historical cancelled appointments grouped by parent email (fallback: user_id). */
async function buildCancelledCountByParentEmail() {
  const { data: cancelledRows, error } = await supabase
    .from('appointments')
    .select('user_id')
    .in('status', CANCELLED_STATUSES);

  if (error) throw error;

  const userIds = [
    ...new Set((cancelledRows || []).map((row) => row.user_id).filter(Boolean)),
  ];

  const emailByUserId = new Map();
  if (userIds.length) {
    const { data: parents, error: parentsError } = await supabase
      .from('parents')
      .select('user_id, email')
      .in('user_id', userIds);

    if (parentsError) throw parentsError;

    for (const parent of parents || []) {
      const email = normalizeParentEmail(parent.email);
      if (parent.user_id && email) {
        emailByUserId.set(String(parent.user_id), email);
      }
    }
  }

  const countsByEmail = new Map();
  const countsByUserId = new Map();

  for (const row of cancelledRows || []) {
    if (!row.user_id) continue;
    const userKey = String(row.user_id);
    countsByUserId.set(userKey, (countsByUserId.get(userKey) || 0) + 1);

    const email = emailByUserId.get(userKey);
    if (email) {
      countsByEmail.set(email, (countsByEmail.get(email) || 0) + 1);
    }
  }

  return { countsByEmail, countsByUserId };
}

function resolveParentCancelledCount(parentEmail, userId, countsByEmail, countsByUserId) {
  const email = normalizeParentEmail(parentEmail);
  if (email) {
    return countsByEmail.get(email) || 0;
  }
  if (userId) {
    return countsByUserId.get(String(userId)) || 0;
  }
  return 0;
}

/** GET /api/admin/appointments — read-only oversight list with joins and no-show flags. */
export async function listAdminAppointmentsOversight(req, res) {
  try {
    const status = String(req.query.status || '').trim().toLowerCase();
    const therapistId = String(req.query.therapist_id || '').trim();
    const dateFrom = String(req.query.date_from || '').trim();
    const dateTo = String(req.query.date_to || '').trim();

    if (status && !APPOINTMENT_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status filter.' });
    }

    let query = supabase
      .from('appointments')
      .select(
        'appointments_id, therapist_id, user_id, child_id, status, appointment_date, notes, zoom_join_url, created_at',
      )
      .order('appointment_date', { ascending: false });

    if (status) query = query.eq('status', status);
    if (therapistId) query = query.eq('therapist_id', therapistId);
    if (dateFrom) query = query.gte('appointment_date', dateFrom);
    if (dateTo) query = query.lte('appointment_date', dateTo);

    const { data: rows, error } = await query;
    if (error) throw error;

    const appointments = rows || [];
    const therapistIds = [...new Set(appointments.map((r) => r.therapist_id).filter(Boolean))];
    const userIds = [...new Set(appointments.map((r) => r.user_id).filter(Boolean))];
    const childIds = [...new Set(appointments.map((r) => r.child_id).filter((id) => id != null))];

    const [therapistsRes, parentsRes, childrenRes, cancelledCounts, allTherapistsRes] =
      await Promise.all([
        therapistIds.length
          ? supabase
              .from('therapists')
              .select('therapist_id, full_name')
              .in('therapist_id', therapistIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? supabase
              .from('parents')
              .select('user_id, full_name, email')
              .in('user_id', userIds)
          : Promise.resolve({ data: [], error: null }),
        childIds.length
          ? supabase
              .from('children')
              .select('children_id, full_name, date_of_birth')
              .in('children_id', childIds)
          : Promise.resolve({ data: [], error: null }),
        buildCancelledCountByParentEmail(),
        supabase
          .from('therapists')
          .select('therapist_id, full_name')
          .order('full_name', { ascending: true }),
      ]);

    if (therapistsRes.error) throw therapistsRes.error;
    if (parentsRes.error) throw parentsRes.error;
    if (childrenRes.error) throw childrenRes.error;
    if (allTherapistsRes.error) throw allTherapistsRes.error;

    const therapistById = Object.fromEntries(
      (therapistsRes.data || []).map((t) => [t.therapist_id, t]),
    );
    const parentByUserId = Object.fromEntries(
      (parentsRes.data || []).map((p) => [p.user_id, p]),
    );
    const childById = Object.fromEntries(
      (childrenRes.data || []).map((c) => [c.children_id, c]),
    );

    const items = appointments.map((r) => {
      const child = r.child_id != null ? childById[r.child_id] : null;
      const parent = parentByUserId[r.user_id] || null;
      const therapist = therapistById[r.therapist_id] || null;
      const cancelledCount = resolveParentCancelledCount(
        parent?.email,
        r.user_id,
        cancelledCounts.countsByEmail,
        cancelledCounts.countsByUserId,
      );
      const noShowPattern = cancelledCount >= 3;

      return {
        appointments_id: r.appointments_id,
        status: r.status,
        appointment_date: r.appointment_date,
        notes: r.notes,
        zoom_join_url: r.zoom_join_url,
        child_name:
          (child?.full_name || '').trim() || childNameFromNotes(r.notes) || null,
        child_age: formatChildAge(child?.date_of_birth),
        child_date_of_birth: child?.date_of_birth ?? null,
        parent_email: parent?.email ?? null,
        parent_name: parent?.full_name ?? null,
        therapist_name: therapist?.full_name ?? null,
        therapist_id: r.therapist_id,
        parent_cancelled_count: cancelledCount,
        no_show_pattern: noShowPattern,
      };
    });

    return res.json({
      items,
      therapists: (allTherapistsRes.data || []).map((t) => ({
        therapist_id: t.therapist_id,
        full_name: t.full_name,
      })),
      statuses: APPOINTMENT_STATUSES,
    });
  } catch (err) {
    console.error('[listAdminAppointmentsOversight]', err);
    return res
      .status(500)
      .json({ message: userFacingErrorMessage(err)});
  }
}
