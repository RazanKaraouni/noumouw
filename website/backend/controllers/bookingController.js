import { getParentSupabase } from '../utils/supabaseForRequest.js';
import { validateRequired, validationErrorResponse } from '../utils/validation.js';
// SERVICE ROLE: justified because public booking availability reads therapist schedules without auth.
import supabase from '../config/supabase.js';
import { getParentUserId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import {
  sendTherapistBookingEmail,
  sendTherapistCancellationRequestEmail,
} from '../services/email.service.js';
import { clearZoomMeetingFields } from '../services/zoom.service.js';
import { backfillZoomForAppointments } from '../services/appointmentZoomService.js';
import {
  sendNotification,
  THERAPIST_NOTIFICATION_TYPES,
} from '../services/notificationService.js';
import { formatSlotDate, formatSlotHm, getNowWallClockInAppTz, slotStartAfterNow } from '../utils/slotTime.js';

function dayRange(dateText) {
  const start = new Date(`${dateText}T00:00:00.000Z`);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    startIso: start.toISOString(),
    nextIso: next.toISOString(),
  };
}

function toDateFromTs(raw) {
  const fromSlot = formatSlotDate(raw);
  if (fromSlot) return fromSlot;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw ?? '').slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function toTimeFromTs(raw) {
  const hm = formatSlotHm(raw);
  return hm ? `${hm}:00` : '';
}

async function resolveChildrenIdFromInput(input) {
  if (input === undefined || input === null || input === '') return null;
  const numericId = Number(input);
  if (Number.isFinite(numericId) && Number.isInteger(numericId)) {
    return numericId;
  }
  const str = String(input).trim();
  if (!str) return null;

  const { data: byLegacyUuid, error: uuidErr } = await supabase
    .from('children')
    .select('children_id')
    .eq('child_id', str)
    .maybeSingle();
  if (uuidErr) throw uuidErr;
  if (byLegacyUuid?.children_id != null) return byLegacyUuid.children_id;

  return null;
}

async function resolveOwnedChildrenIdForParent(input, parentUserId, db = supabase) {
  const childrenId = await resolveChildrenIdFromInput(input);
  if (childrenId == null) return null;
  const { data, error } = await db
    .from('children')
    .select('children_id')
    .eq('children_id', childrenId)
    .eq('parent_id', parentUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = new Error('child_id must belong to the signed-in parent.');
    err.status = 403;
    throw err;
  }
  return childrenId;
}

function childNameFromNotes(notes) {
  const m = String(notes ?? '').match(/Child for appointment:\s*(.+?)\s*\(/);
  return m ? m[1].trim() : '';
}

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'cancellation_requested'];
const ALREADY_TAKEN_MESSAGE = 'ALREADY TAKEN';

/** Slots with pending/confirmed/cancellation_requested appointments are not bookable. */
async function getTakenAvailabilityIdSet(availabilityIds) {
  const ids = [...new Set((availabilityIds || []).filter(Boolean))];
  if (!ids.length) return new Set();
  const { data, error } = await supabase
    .from('appointments')
    .select('availability_id')
    .in('availability_id', ids)
    .in('status', ACTIVE_BOOKING_STATUSES);
  if (error) throw error;
  return new Set((data || []).map((r) => r.availability_id));
}

async function filterOpenAvailabilityRows(rows) {
  const slots = rows || [];
  const taken = await getTakenAvailabilityIdSet(slots.map((r) => r.availability_id));
  return slots.filter((r) => !taken.has(r.availability_id));
}

/** Drop slots whose start time has already passed (same-day bookings only show future times). */
function filterFutureBookableSlotRows(rows) {
  return (rows || []).filter((r) => {
    const dateStr = toDateFromTs(r.start_time);
    const startTime = toTimeFromTs(r.start_time) || formatSlotHm(r.start_time);
    return slotStartAfterNow(dateStr, startTime);
  });
}

async function filterBookableAvailabilityRows(rows) {
  return filterFutureBookableSlotRows(await filterOpenAvailabilityRows(rows));
}

async function tryLockAvailabilitySlot(availabilityId) {
  const { data, error } = await supabase
    .from('availability')
    .update({ is_booked: true })
    .eq('availability_id', availabilityId)
    .eq('is_booked', false)
    .select('availability_id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.availability_id);
}

async function releaseAvailabilitySlot(availabilityId) {
  if (!availabilityId) return;
  const { error } = await supabase
    .from('availability')
    .update({ is_booked: false })
    .eq('availability_id', availabilityId);
  if (error) throw error;
}

function addDaysYmd(ymd, deltaDays) {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CANCELLATION_TOO_LATE_MESSAGE =
  'The cancellation request day must be before the appointment day by at least one day.';

function appointmentStatusConstraintMessage(err) {
  const msg = String(err?.message || '');
  if (msg.includes('appointments_status_check')) {
    return (
      'Appointment status is not allowed by the database. Run ' +
      'website/backend/sql/appointments_status_cancellation_requested.sql in Supabase ' +
      '(adds cancellation_requested to the status check).'
    );
  }
  return msg || 'Booking failed.';
}

function isCancellationRequestDayValid(appointmentDateYmd) {
  const apptDay = String(appointmentDateYmd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apptDay)) return true;
  const latestRequestDay = addDaysYmd(apptDay, -1);
  if (!latestRequestDay) return true;
  return todayYmdLocal() <= latestRequestDay;
}

const PARENT_APPOINTMENT_COLUMNS =
  'appointments_id, availability_id, status, appointment_date, therapist_id, notes, child_id, created_at, zoom_join_url, zoom_password, zoom_meeting_id, is_started';

async function enrichAndMapParentAppointments(appointments) {
  const therapistIds = [
    ...new Set(appointments.map((r) => r.therapist_id).filter(Boolean)),
  ];
  const availabilityIds = [
    ...new Set(appointments.map((r) => r.availability_id).filter(Boolean)),
  ];
  const childIds = [
    ...new Set(appointments.map((r) => r.child_id).filter((id) => id != null)),
  ];

  const [therapistsRes, availabilityRes, childrenRes] = await Promise.all([
    therapistIds.length
      ? supabase
          .from('therapists')
          .select('therapist_id, full_name, profession')
          .in('therapist_id', therapistIds)
      : Promise.resolve({ data: [], error: null }),
    availabilityIds.length
      ? supabase
          .from('availability')
          .select('availability_id, start_time, end_time')
          .in('availability_id', availabilityIds)
      : Promise.resolve({ data: [], error: null }),
    childIds.length
      ? supabase
          .from('children')
          .select('children_id, full_name')
          .in('children_id', childIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (therapistsRes.error) throw therapistsRes.error;
  if (availabilityRes.error) throw availabilityRes.error;
  if (childrenRes.error) throw childrenRes.error;

  const therapistById = Object.fromEntries(
    (therapistsRes.data || []).map((t) => [t.therapist_id, t]),
  );
  const availabilityById = Object.fromEntries(
    (availabilityRes.data || []).map((a) => [a.availability_id, a]),
  );
  const childById = Object.fromEntries(
    (childrenRes.data || []).map((c) => [c.children_id, c]),
  );

  // Zoom backfill calls the external Zoom API — run in background so list stays under 2s.
  void backfillZoomForAppointments(appointments, availabilityById);

  return appointments.map((r) => {
    const t = therapistById[r.therapist_id] || {};
    const avail = availabilityById[r.availability_id] || {};
    const child = r.child_id != null ? childById[r.child_id] : null;
    const childName =
      (child?.full_name || '').trim() || childNameFromNotes(r.notes) || 'Child';

    return {
      appointments_id: r.appointments_id,
      availability_id: r.availability_id,
      status: r.status,
      appointment_date: r.appointment_date,
      therapist_id: r.therapist_id,
      notes: r.notes,
      child_id: r.child_id,
      child_name: childName,
      created_at: r.created_at,
      zoom_join_url: r.zoom_join_url ?? null,
      zoom_password: r.zoom_password ?? null,
      zoom_meeting_id: r.zoom_meeting_id ?? null,
      zoomJoinUrl: r.zoom_join_url ?? null,
      zoomPassword: r.zoom_password ?? null,
      zoomMeetingId: r.zoom_meeting_id ?? null,
      is_started: r.is_started === true,
      isStarted: r.is_started === true,
      therapist_full_name: (t.full_name || '').trim(),
      therapists: {
        full_name: (t.full_name || '').trim(),
        profession: (t.profession || '').trim(),
      },
      availability: {
        start_time: avail.start_time ?? null,
        end_time: avail.end_time ?? null,
      },
    };
  });
}

/** Parent: list own appointments with therapist, slot time, and child name. */
export async function listParentAppointments(req, res) {
  try {
    const userId = getParentUserId(req);
    const db = getParentSupabase(req);
    const { data: rows, error } = await db
      .from('appointments')
      .select(PARENT_APPOINTMENT_COLUMNS)
      .eq('user_id', userId)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const mapped = await enrichAndMapParentAppointments(rows || []);
    res.json(mapped);
  } catch (err) {
    console.error(err);
    sendErrorResponse(res, err, 500);
  }
}

/** Parent: fetch one appointment (includes completed — used after session ends). */
export async function getParentAppointmentById(req, res) {
  try {
    const userId = getParentUserId(req);
    const appointmentsId = String(req.params.appointmentsId || '').trim();
    if (!appointmentsId) {
      return res.status(400).json({ message: 'appointments_id is required.' });
    }

    const db = getParentSupabase(req);
    const { data: row, error } = await db
      .from('appointments')
      .select(PARENT_APPOINTMENT_COLUMNS)
      .eq('appointments_id', appointmentsId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return res.status(404).json({ message: 'Appointment not found.' });

    const [mapped] = await enrichAndMapParentAppointments([row]);
    return res.json(mapped);
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}

/** Unbooked slots on a date across all therapists (parent booking — no therapist pick). */
export async function getAllAvailabilitySlots(req, res) {
  try {
    const date = req.query.date;
    if (!date) {
      return res.status(400).json({ message: 'date query param required.' });
    }
    const { startIso, nextIso } = dayRange(date);

    const { data, error } = await supabase
      .from('availability')
      .select('availability_id, therapist_id, start_time, end_time, is_booked')
      .gte('start_time', startIso)
      .lt('start_time', nextIso)
      .eq('is_booked', false)
      .order('start_time');

    if (error) throw error;

    const openSlots = await filterBookableAvailabilityRows(data || []);
    const therapistIds = [
      ...new Set(openSlots.map((r) => r.therapist_id).filter(Boolean)),
    ];

    let therapistById = {};
    if (therapistIds.length > 0) {
      const therapistsRes = await supabase
        .from('therapists')
        .select('therapist_id, full_name, profession, address, profile_image_url')
        .in('therapist_id', therapistIds);
      if (therapistsRes.error) throw therapistsRes.error;
      therapistById = Object.fromEntries(
        (therapistsRes.data || []).map((t) => [t.therapist_id, t]),
      );
    }

    const mapped = openSlots.map((r) => {
      const t = therapistById[r.therapist_id] || {};
      return {
        availability_id: r.availability_id,
        therapist_id: r.therapist_id,
        start_time: toTimeFromTs(r.start_time),
        end_time: toTimeFromTs(r.end_time),
        slot_date: toDateFromTs(r.start_time),
        full_name: (t.full_name || '').trim(),
        profession: (t.profession || '').trim(),
        address: (t.address || '').trim(),
        profile_image_url: (t.profile_image_url || '').trim(),
      };
    });
    res.json(mapped);
  } catch (err) {
    console.error(err);
    sendErrorResponse(res, err, 500);
  }
}

/** Dates (next 31 days) with any unbooked slot from any therapist. */
export async function getAllAvailableDatesSummary(req, res) {
  try {
    const from = req.query.from || getNowWallClockInAppTz().date;
    const to = req.query.to;
    const { startIso } = dayRange(from);

    let q = supabase
      .from('availability')
      .select('availability_id, start_time')
      .eq('is_booked', false)
      .gte('start_time', startIso)
      .order('start_time');

    if (to) {
      const toStart = dayRange(to).startIso;
      const toNext = new Date(toStart);
      toNext.setUTCDate(toNext.getUTCDate() + 1);
      q = q.lt('start_time', toNext.toISOString());
    } else {
      q = q.limit(500);
    }

    const { data, error } = await q;
    if (error) throw error;
    const openSlots = await filterBookableAvailabilityRows(data || []);
    const unique = [...new Set(openSlots.map((r) => toDateFromTs(r.start_time)))];
    unique.sort();
    res.json(unique);
  } catch (err) {
    console.error(err);
    sendErrorResponse(res, err, 500);
  }
}

export async function getAvailabilitySlots(req, res) {
  try {
    const therapistId = req.query.therapist_id;
    const date = req.query.date;
    if (!therapistId || !date) {
      return res.status(400).json({ message: 'therapist_id and date query params required.' });
    }
    const { startIso, nextIso } = dayRange(date);

    const { data, error } = await supabase
      .from('availability')
      .select('availability_id, therapist_id, start_time, end_time, is_booked')
      .eq('therapist_id', therapistId)
      .gte('start_time', startIso)
      .lt('start_time', nextIso)
      .eq('is_booked', false)
      .order('start_time');

    if (error) throw error;
    const openSlots = await filterBookableAvailabilityRows(data || []);
    const mapped = openSlots.map((r) => ({
      ...r,
      slot_date: toDateFromTs(r.start_time),
      start_time: toTimeFromTs(r.start_time),
      end_time: toTimeFromTs(r.end_time),
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    sendErrorResponse(res, err, 500);
  }
}

/** Dates (next 31 days) that have any unbooked slot — for horizontal date strip. */
export async function getAvailableDatesSummary(req, res) {
  try {
    const therapistId = req.query.therapist_id;
    if (!therapistId) {
      return res.status(400).json({ message: 'therapist_id required.' });
    }
    const from = req.query.from || getNowWallClockInAppTz().date;
    const to = req.query.to;
    const { startIso } = dayRange(from);

    let q = supabase
      .from('availability')
      .select('availability_id, start_time')
      .eq('therapist_id', therapistId)
      .eq('is_booked', false)
      .gte('start_time', startIso)
      .order('start_time');

    if (to) {
      const toStart = dayRange(to).startIso;
      const toNext = new Date(toStart);
      toNext.setUTCDate(toNext.getUTCDate() + 1);
      q = q.lt('start_time', toNext.toISOString());
    }
    else q = q.limit(500);

    const { data, error } = await q;
    if (error) throw error;
    const openSlots = await filterBookableAvailabilityRows(data || []);
    const unique = [...new Set(openSlots.map((r) => toDateFromTs(r.start_time)))];
    unique.sort();
    res.json(unique);
  } catch (err) {
    console.error(err);
    sendErrorResponse(res, err, 500);
  }
}

export async function bookAppointment(req, res) {
  try {
    const userId = getParentUserId(req);
    const requiredErrors = validateRequired(['availability_id', 'child_id'], {
      ...req.body,
      child_id: req.body?.children_id ?? req.body?.child_id,
    });
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const {
      availability_id,
      child_id: rawChildId,
      children_id: childrenIdInput,
      notes,
    } = req.body || {};
    const childInput = childrenIdInput ?? rawChildId;

    const db = getParentSupabase(req);
    const slot = await supabase
      .from('availability')
      .select('availability_id, therapist_id, start_time, end_time, is_booked')
      .eq('availability_id', availability_id)
      .maybeSingle();
    if (slot.error) throw slot.error;
    if (!slot.data || slot.data.is_booked) {
      return res.status(409).json({ message: ALREADY_TAKEN_MESSAGE });
    }
    const s = slot.data;
    const slotDate = toDateFromTs(s.start_time);
    const slotStart = toTimeFromTs(s.start_time) || formatSlotHm(s.start_time);
    if (!slotStartAfterNow(slotDate, slotStart)) {
      return res.status(409).json({ message: 'This time slot has already passed.' });
    }

    const existingActive = await supabase
      .from('appointments')
      .select('appointments_id')
      .eq('availability_id', availability_id)
      .in('status', ['pending', 'confirmed', 'cancellation_requested'])
      .limit(1);
    if (existingActive.error) throw existingActive.error;
    if ((existingActive.data || []).length > 0) {
      return res.status(409).json({ message: ALREADY_TAKEN_MESSAGE });
    }

    const locked = await tryLockAvailabilitySlot(availability_id);
    if (!locked) {
      return res.status(409).json({ message: ALREADY_TAKEN_MESSAGE });
    }

    const childrenId = await resolveOwnedChildrenIdForParent(childInput, userId, db);
    if (childrenId == null) {
      await releaseAvailabilitySlot(availability_id);
      return res.status(400).json({ message: 'A valid child_id is required.' });
    }

    const appointmentDate = slotDate;
    const nowIso = new Date().toISOString();
    // Child ownership verified above; service role insert because some Supabase envs
    // have RLS enabled on appointments without a matching parent INSERT policy.
    let ins;
    try {
      ins = await supabase
        .from('appointments')
        .insert({
          user_id: userId,
          therapist_id: s.therapist_id,
          availability_id: s.availability_id,
          child_id: childrenId,
          appointment_date: appointmentDate,
          notes: notes == null ? null : String(notes),
          status: 'pending',
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('appointments_id')
        .single();
      if (ins.error) throw ins.error;
    } catch (insertErr) {
      await releaseAvailabilitySlot(availability_id);
      throw insertErr;
    }

    let therapistEmailNotified = false;
    try {
      const [therapistRow, parentRow] = await Promise.all([
        supabase
          .from('therapists')
          .select('full_name,email')
          .eq('therapist_id', s.therapist_id)
          .maybeSingle(),
        supabase
          .from('parents')
          .select('full_name')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (therapistRow.error) throw therapistRow.error;
      if (parentRow.error) throw parentRow.error;

      const t = therapistRow.data || {};
      const p = parentRow.data || {};
      const therapistName = (t.full_name || '').trim();
      const parentName = (p.full_name || '').trim();

      try {
        await sendNotification({
          recipientId: s.therapist_id,
          senderId: userId,
          type: THERAPIST_NOTIFICATION_TYPES.APPOINTMENT_REQUEST,
          title: 'New appointment request',
          message: `${parentName || 'A parent'} requested an appointment on ${appointmentDate}.`,
        });
      } catch (notifErr) {
        console.error('[bookAppointment] sendNotification:', notifErr?.message || notifErr);
      }

      therapistEmailNotified = await sendTherapistBookingEmail({
        therapistEmail: t.email,
        therapistName,
        parentName,
        appointmentDate,
        startTime: toTimeFromTs(s.start_time),
        endTime: toTimeFromTs(s.end_time),
      });
    } catch (emailErr) {
      console.error('Therapist booking email failed:', emailErr?.message || emailErr);
    }

    res.status(201).json({
      appointments_id: ins.data.appointments_id,
      therapist_email_notified: therapistEmailNotified,
    });
  } catch (err) {
    console.error(err);
    const status =
      err?.code === '23505' || String(err?.message || '').includes(ALREADY_TAKEN_MESSAGE)
        ? 409
        : Number(err.status) >= 400 && Number(err.status) < 600
          ? err.status
          : 500;
    if (status === 409) {
      return res.status(409).json({ message: ALREADY_TAKEN_MESSAGE });
    }
    sendErrorResponse(res, err, status);
  }
}

export async function updateParentAppointment(req, res) {
  try {
    const userId = getParentUserId(req);
    const db = getParentSupabase(req);
    const appointmentsId = String(req.params.appointmentsId || '').trim();
    const status = String(req.body?.status || '').toLowerCase().trim();
    if (!appointmentsId) {
      return res.status(400).json({ message: 'appointments_id is required.' });
    }
    if (status !== 'cancelled') {
      return res.status(400).json({ message: 'Only status "cancelled" is supported.' });
    }

    const apptRes = await db
      .from('appointments')
      .select('appointments_id, user_id, status, availability_id, zoom_meeting_id')
      .eq('appointments_id', appointmentsId)
      .eq('user_id', userId)
      .maybeSingle();
    if (apptRes.error) throw apptRes.error;
    if (!apptRes.data) return res.status(404).json({ message: 'Appointment not found.' });

    const currentStatus = String(apptRes.data.status || '').toLowerCase();
    if (currentStatus === 'cancelled' || currentStatus === 'canceled') {
      return res.json({ ok: true, status: 'cancelled', message: 'Already cancelled.' });
    }
    if (currentStatus !== 'pending') {
      return res.status(400).json({
        message: 'Only pending appointments can be cancelled directly.',
      });
    }

    const zoomClear = await clearZoomMeetingFields(apptRes.data.zoom_meeting_id);
    const nowIso = new Date().toISOString();
    const upd = await db
      .from('appointments')
      .update({ status: 'cancelled', updated_at: nowIso, ...zoomClear })
      .eq('appointments_id', appointmentsId)
      .eq('user_id', userId)
      .select('appointments_id, status')
      .maybeSingle();
    if (upd.error) throw upd.error;
    if (!upd.data) return res.status(404).json({ message: 'Appointment not found.' });

    const availabilityId = apptRes.data.availability_id;
    if (availabilityId) {
      const slotUpd = await supabase
        .from('availability')
        .update({ is_booked: false })
        .eq('availability_id', availabilityId);
      if (slotUpd.error) throw slotUpd.error;
    }

    return res.json({ ok: true, status: 'cancelled', appointments_id: appointmentsId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: appointmentStatusConstraintMessage(err) || 'Could not update appointment.',
    });
  }
}

/** Parent: request cancellation; therapist must approve in dashboard. */
export async function requestParentAppointmentCancellation(req, res) {
  try {
    const userId = getParentUserId(req);
    const db = getParentSupabase(req);
    const appointmentsId = String(req.params.appointmentsId || '').trim();
    if (!appointmentsId) {
      return res.status(400).json({ message: 'appointments_id is required.' });
    }

    const apptRes = await db
      .from('appointments')
      .select(
        'appointments_id, user_id, therapist_id, child_id, availability_id, appointment_date, status, notes, zoom_meeting_id, availability:availability_id(start_time, end_time)',
      )
      .eq('appointments_id', appointmentsId)
      .eq('user_id', userId)
      .maybeSingle();
    if (apptRes.error) throw apptRes.error;
    if (!apptRes.data) return res.status(404).json({ message: 'Appointment not found.' });

    const current = apptRes.data;
    const status = String(current.status || '').toLowerCase();
    if (status === 'cancellation_requested') {
      return res.json({
        ok: true,
        status: 'cancellation_requested',
        message: 'Cancellation already requested.',
        therapist_email_notified: false,
      });
    }
    if (!['pending', 'confirmed'].includes(status)) {
      return res.status(400).json({
        message: 'Only pending or confirmed appointments can be cancelled.',
      });
    }
    if (status === 'completed' || status === 'cancelled') {
      return res.status(400).json({ message: 'This appointment cannot be cancelled.' });
    }

    const appointmentDateYmd =
      String(current.appointment_date || '').slice(0, 10) ||
      toDateFromTs(current.availability?.start_time);
    if (!isCancellationRequestDayValid(appointmentDateYmd)) {
      return res.status(400).json({ message: CANCELLATION_TOO_LATE_MESSAGE });
    }

    const avail = current.availability || {};
    const startRaw = avail.start_time;
    if (startRaw) {
      const startMs = new Date(startRaw).getTime();
      if (!Number.isNaN(startMs)) {
        const hoursUntil = (startMs - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < 2) {
          return res.status(400).json({
            message: 'Cannot request cancellation within 2 hours of the session.',
          });
        }
      }
    }

    const zoomClear = await clearZoomMeetingFields(current.zoom_meeting_id);
    const nowIso = new Date().toISOString();
    const upd = await db
      .from('appointments')
      .update({ status: 'cancellation_requested', updated_at: nowIso, ...zoomClear })
      .eq('appointments_id', appointmentsId)
      .eq('user_id', userId)
      .select('appointments_id, status')
      .maybeSingle();
    if (upd.error) throw upd.error;
    if (!upd.data) return res.status(404).json({ message: 'Appointment not found.' });

    let therapistEmailNotified = false;
    try {
      const [therapistRow, parentRow, childRow] = await Promise.all([
        supabase
          .from('therapists')
          .select('full_name, email')
          .eq('therapist_id', current.therapist_id)
          .maybeSingle(),
        supabase
          .from('parents')
          .select('full_name, email')
          .eq('user_id', userId)
          .maybeSingle(),
        current.child_id != null
          ? supabase
              .from('children')
              .select('full_name')
              .eq('children_id', current.child_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (therapistRow.error) throw therapistRow.error;
      if (parentRow.error) throw parentRow.error;
      if (childRow?.error) throw childRow.error;

      const t = therapistRow.data || {};
      const p = parentRow.data || {};
      const c = childRow?.data || {};
      const childName =
        (c.full_name || '').trim() || childNameFromNotes(current.notes) || 'Child';

      therapistEmailNotified = await sendTherapistCancellationRequestEmail({
        therapistEmail: t.email,
        therapistName: (t.full_name || '').trim(),
        parentName: (p.full_name || '').trim(),
        parentEmail: (p.email || '').trim(),
        appointmentDate: current.appointment_date || toDateFromTs(startRaw),
        startTime: toTimeFromTs(startRaw),
        endTime: toTimeFromTs(avail.end_time),
        childName,
      });
    } catch (emailErr) {
      console.error('Therapist cancellation request email failed:', emailErr?.message || emailErr);
    }

    return res.json({
      ok: true,
      status: 'cancellation_requested',
      therapist_email_notified: therapistEmailNotified,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: appointmentStatusConstraintMessage(err) || 'Could not request cancellation.',
    });
  }
}
