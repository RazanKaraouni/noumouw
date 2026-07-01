import supabase from '../config/supabase.js';
import { getTherapistId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { clearZoomMeetingFields, isTerminalZoomClearStatus } from '../services/zoom.service.js';
import {
  createZoomPayloadForAppointment,
  backfillZoomForAppointments,
} from '../services/appointmentZoomService.js';
import { sendParentDecisionEmail } from '../services/email.service.js';
import { notifyParent as pushParentNotification } from '../services/notificationService.js';
import { upsertTherapistChildLink } from '../services/therapistChildLinkService.js';
import { loadTherapistChildBundle } from '../services/therapistChildBundleService.js';
import { ensurePendingPaymentForAppointment } from '../services/paymentService.js';
import { formatSlotDate, formatSlotHm, getMeetingStartWindowStatus } from '../utils/slotTime.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDateFromTs(raw) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw ?? '').slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function zoomFieldsFromRow(r) {
  return {
    zoom_join_url: r.zoom_join_url ?? null,
    zoom_password: r.zoom_password ?? null,
    zoom_start_url: r.zoom_start_url ?? null,
    zoom_meeting_id: r.zoom_meeting_id ?? null,
    zoomJoinUrl: r.zoom_join_url ?? null,
    zoomPassword: r.zoom_password ?? null,
    zoomStartUrl: r.zoom_start_url ?? null,
    zoomMeetingId: r.zoom_meeting_id ?? null,
  };
}

function childNameFromNotes(notes) {
  const m = String(notes ?? '').match(/Child for appointment:\s*(.+?)\s*\(/);
  return m ? m[1].trim() : '';
}

function childAgeLabelFromDob(rawDob) {
  if (!rawDob) return null;
  const dob = new Date(rawDob);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) months = 0;
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}y` : `${y}y ${m}mo`;
}

/** GET /api/therapists/appointments/mine — therapist caseload appointments with parent/child/slot details. */
export async function listMyTherapistAppointments(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(400).json({ message: 'Therapist identity missing from token.' });
    }

    const { data: rows, error } = await supabase
      .from('appointments')
      .select(
        'appointments_id, availability_id, status, appointment_date, user_id, notes, child_id, created_at, zoom_join_url, zoom_password, zoom_start_url, zoom_meeting_id, is_started',
      )
      .eq('therapist_id', therapistId)
      .order('appointment_date', { ascending: false });

    if (error) throw error;

    const appointments = rows || [];
    const userIds = [...new Set(appointments.map((r) => r.user_id).filter(Boolean))];
    const availabilityIds = [...new Set(appointments.map((r) => r.availability_id).filter(Boolean))];
    const childIds = [...new Set(appointments.map((r) => r.child_id).filter((id) => id != null))];

    const [parentsRes, availabilityRes, childrenRes] = await Promise.all([
      userIds.length
        ? supabase.from('parents').select('user_id, full_name, email').in('user_id', userIds)
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
            .select('children_id, full_name, date_of_birth')
            .in('children_id', childIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (parentsRes.error) throw parentsRes.error;
    if (availabilityRes.error) throw availabilityRes.error;
    if (childrenRes.error) throw childrenRes.error;

    const parentByUserId = Object.fromEntries((parentsRes.data || []).map((p) => [p.user_id, p]));
    const availabilityById = Object.fromEntries(
      (availabilityRes.data || []).map((a) => [a.availability_id, a]),
    );
    const childById = Object.fromEntries((childrenRes.data || []).map((c) => [c.children_id, c]));

    void backfillZoomForAppointments(appointments, availabilityById).catch((zoomErr) => {
      console.warn('[listMyTherapistAppointments] zoom backfill:', zoomErr?.message || zoomErr);
    });

    const mapped = appointments.map((r) => {
      const par = parentByUserId[r.user_id] || {};
      const avail = availabilityById[r.availability_id] || {};
      const child = r.child_id != null ? childById[r.child_id] : null;
      const startHm = formatSlotHm(avail.start_time);
      const endHm = formatSlotHm(avail.end_time);
      const slotDate = formatSlotDate(avail.start_time);

      return {
        appointments_id: r.appointments_id,
        availability_id: r.availability_id,
        status: String(r.status || 'pending').toLowerCase().trim() || 'pending',
        appointment_date: slotDate || formatSlotDate(r.appointment_date) || String(r.appointment_date || '').slice(0, 10),
        user_id: r.user_id,
        notes: r.notes,
        child_id: r.child_id,
        created_at: r.created_at,
        is_started: r.is_started,
        ...zoomFieldsFromRow(r),
        parent_name: (par.full_name || '').trim() || '—',
        parent_email: par.email ?? null,
        child_name: (child?.full_name || '').trim() || childNameFromNotes(r.notes) || '—',
        child_dob: child?.date_of_birth ?? null,
        child_age: childAgeLabelFromDob(child?.date_of_birth),
        appointment_start_time: startHm || null,
        appointment_end_time: endHm || null,
        appointment_time: startHm || null,
      };
    });

    return res.json(mapped);
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}

/** PATCH /api/therapists/appointments/:id/decision — confirm or reject (cancel) an appointment. */
export async function appointmentDecision(req, res) {
  try {
    const { id } = req.params;
    const action = String(req.body?.action || '').toLowerCase().trim();
    const therapistId = getTherapistId(req);

    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({ message: 'Invalid appointment id.' });
    }
    if (!['confirm', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be confirm or reject.' });
    }

    const { data: current, error: checkErr } = await supabase
      .from('appointments')
      .select('therapist_id, status')
      .eq('appointments_id', id)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (!current || current.therapist_id !== therapistId) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const currentStatus = String(current.status || '').toLowerCase();
    if (action === 'confirm') {
      if (currentStatus === 'cancellation_requested') {
        return res.status(400).json({ message: 'Cannot confirm a cancellation request.' });
      }
      req.body.status = 'confirmed';
    } else {
      req.body.status = 'cancelled';
    }

    return updateAppointmentStatus(req, res);
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}

export async function updateAppointmentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status: nextStatus, remarks } = req.body;
    const therapistId = getTherapistId(req);

    if (!id || !UUID_RE.test(id)) return res.status(400).json({ message: 'Invalid assignment format.' });

    const { data: current, error: checkErr } = await supabase
      .from('appointments')
      .select('*, availability:availability_id(*)')
      .eq('appointments_id', id)
      .single();

    if (checkErr || !current) return res.status(404).json({ message: 'Appointment item tracking missing.' });
    if (current.therapist_id !== therapistId) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const childId = current.child_id;
    let zoomPayload = {
      zoom_join_url: current.zoom_join_url,
      zoom_password: current.zoom_password,
      zoom_start_url: current.zoom_start_url,
      zoom_meeting_id: current.zoom_meeting_id,
    };

    if (isTerminalZoomClearStatus(nextStatus)) {
      const cleared = await clearZoomMeetingFields(current.zoom_meeting_id);
      if (cleared.zoom_meeting_id === null) {
        zoomPayload = {
          zoom_join_url: null,
          zoom_password: null,
          zoom_start_url: null,
          zoom_meeting_id: null,
        };
      }
    }

    if (nextStatus === 'confirmed' && !zoomPayload.zoom_join_url) {
      try {
        const created = await createZoomPayloadForAppointment(current, current.availability);
        if (created) zoomPayload = created;
      } catch (zoomErr) {
        console.error('⚠️ Zoom credentials offline. Saving without link:', zoomErr.message);
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('appointments')
      .update({
        status: nextStatus,
        notes: remarks !== undefined ? remarks : current.notes,
        zoom_join_url: zoomPayload.zoom_join_url,
        zoom_password: zoomPayload.zoom_password,
        zoom_start_url: zoomPayload.zoom_start_url,
        zoom_meeting_id: zoomPayload.zoom_meeting_id,
        updated_at: new Date().toISOString(),
      })
      .eq('appointments_id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (String(nextStatus).toLowerCase() === 'cancelled' && current.availability_id) {
      const slotRelease = await supabase
        .from('availability')
        .update({ is_booked: false })
        .eq('availability_id', current.availability_id);
      if (slotRelease.error) {
        console.error('[updateAppointmentStatus] release slot:', slotRelease.error.message);
      }
    }

    if (nextStatus === 'completed') {
      try {
        await ensurePendingPaymentForAppointment(updated);
      } catch (paymentErr) {
        console.error('[updateAppointmentStatus] payment:', paymentErr?.message || paymentErr);
      }
    }

    const [therapistRow, parentRow, childRow] = await Promise.all([
      supabase.from('therapists').select('full_name').eq('therapist_id', current.therapist_id).maybeSingle(),
      supabase.from('parents').select('full_name, email').eq('user_id', current.user_id).maybeSingle(),
      childId
        ? supabase.from('children').select('full_name').eq('children_id', childId).maybeSingle()
        : Promise.resolve(null),
    ]);

    const p = parentRow?.data || {};
    const t = therapistRow?.data || {};
    const c = childRow?.data || {};
    const parentName = (p.full_name || '').trim() || 'Parent';
    const therapistName = (t.full_name || '').trim() || 'Therapist';
    const childName = (c.full_name || '').trim() || 'your child';
    const appointmentDate =
      current.appointment_date || toDateFromTs(current.availability?.start_time);
    const startHm = formatSlotHm(current.availability?.start_time);
    const endHm = formatSlotHm(current.availability?.end_time);
    const appointmentTime =
      startHm && endHm ? `${startHm} – ${endHm}` : startHm || endHm || 'Unknown time';
    const body = `Hello ${parentName}, your appointment is ${nextStatus === 'confirmed' ? 'confirmed' : 'cancelled'} with ${therapistName} on ${appointmentDate} from ${appointmentTime} for ${childName}.`;

    try {
      await pushParentNotification({
        userId: current.user_id,
        appointmentId: current.appointments_id,
        type: nextStatus === 'confirmed' ? 'appointment_confirmed' : 'appointment_cancelled',
        title: nextStatus === 'confirmed' ? 'Appointment confirmed' : 'Appointment cancelled',
        message: body,
      });
    } catch (e) {
      console.error(e);
    }

    try {
      await sendParentDecisionEmail(
        {
          toEmail: p.email,
          parentName,
          therapistName,
          appointmentDate,
          appointmentTime,
          childName,
          action: nextStatus,
        },
        nextStatus === 'confirmed' ? zoomPayload.zoom_join_url : null,
      );
    } catch (e) {
      console.error(e);
    }

    if (nextStatus === 'confirmed' && childId != null) {
      try {
        await upsertTherapistChildLink({
          therapistId,
          appointmentsId: current.appointments_id,
          userId: current.user_id,
          childId,
        });
      } catch (e) {
        console.error(e);
      }
    }

    let child_preview = null;
    if (nextStatus === 'confirmed' && childId != null) {
      try {
        child_preview = await loadTherapistChildBundle({
          therapistId,
          childId,
          appointmentContext: {
            appointments_id: current.appointments_id,
            status: nextStatus,
            appointment_date: appointmentDate,
            notes: current.notes || null,
          },
        });
      } catch (e) {
        console.error(e);
      }
    }

    return res.json({
      ok: true,
      appointments_id: updated.appointments_id,
      child_id: childId,
      status: updated.status,
      child_preview,
      ...zoomFieldsFromRow(updated),
    });
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}

export async function getAppointmentChildPreview(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const appointmentsId = req.params.appointments_id || req.params.id;
    if (!appointmentsId) return res.status(400).json({ message: 'appointments_id is required.' });

    const apptRes = await supabase
      .from('appointments')
      .select(
        'appointments_id, user_id, therapist_id, child_id, status, notes, appointment_date, availability:availability_id(start_time, end_time)',
      )
      .eq('appointments_id', appointmentsId)
      .eq('therapist_id', therapistId)
      .maybeSingle();

    if (apptRes.error) throw apptRes.error;
    if (!apptRes.data) return res.status(404).json({ message: 'Appointment not found.' });

    const appt = apptRes.data;
    if (['cancelled', 'canceled'].includes(String(appt.status || '').toLowerCase())) {
      return res.status(400).json({ message: 'Child preview not available for cancelled appointments.' });
    }
    if (!appt.child_id) return res.status(404).json({ message: 'No child assignment bound to this session.' });

    const bundle = await loadTherapistChildBundle({
      therapistId,
      childId: appt.child_id,
      appointmentContext: {
        appointments_id: appt.appointments_id,
        status: appt.status,
        appointment_date: appt.appointment_date,
        notes: appt.notes,
      },
    });
    return res.json(bundle);
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}

export async function completeAppointmentSession(req, res) {
  try {
    const { appointmentId } = req.params;
    const { data: updated, error: updateErr } = await supabase
      .from('appointments')
      .update({ status: 'completed', is_started: false, updated_at: new Date().toISOString() })
      .eq('appointments_id', appointmentId)
      .select()
      .single();
    if (updateErr) throw updateErr;

    let payment = null;
    try {
      payment = await ensurePendingPaymentForAppointment(updated);
    } catch (paymentErr) {
      console.error('[completeAppointmentSession] payment:', paymentErr?.message || paymentErr);
    }

    return res.json({
      ok: true,
      message: 'Consultation session successfully closed.',
      appointment: updated,
      payment,
    });
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function startTherapistSession(req, res) {
  try {
    const { appointmentId } = req.params;
    const therapistId = getTherapistId(req);
    if (!appointmentId || !UUID_RE.test(appointmentId)) {
      return res.status(400).json({ message: 'Invalid appointment id.' });
    }

    const { data: current, error: fetchErr } = await supabase
      .from('appointments')
      .select('*, availability:availability_id(*)')
      .eq('appointments_id', appointmentId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!current || current.therapist_id !== therapistId) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    if (String(current.status || '').toLowerCase() !== 'confirmed') {
      return res.status(400).json({ message: 'Only confirmed appointments can be started.' });
    }

    const meetingWindow = getMeetingStartWindowStatus({
      appointmentDate:
        formatSlotDate(current.availability?.start_time) ||
        formatSlotDate(current.appointment_date) ||
        String(current.appointment_date || '').slice(0, 10),
      startTimeHm: formatSlotHm(current.availability?.start_time),
      endTimeHm: formatSlotHm(current.availability?.end_time),
    });
    if (meetingWindow.status === 'too_early' || meetingWindow.status === 'ended') {
      return res.status(400).json({ message: meetingWindow.message });
    }

    let zoomPayload = {
      zoom_join_url: current.zoom_join_url,
      zoom_password: current.zoom_password,
      zoom_start_url: current.zoom_start_url,
      zoom_meeting_id: current.zoom_meeting_id,
    };

    if (!zoomPayload.zoom_join_url) {
      try {
        const created = await createZoomPayloadForAppointment(current, current.availability);
        if (created) zoomPayload = created;
      } catch (zoomErr) {
        console.warn(
          `⚠️  Zoom create on start failed for ${appointmentId}:`,
          zoomErr?.message || zoomErr,
        );
      }
    }

    if (!zoomPayload.zoom_join_url) {
      return res.status(502).json({
        message:
          'Could not create a Zoom meeting. Check ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET on the server.',
      });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('appointments')
      .update({
        is_started: true,
        ...zoomPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('appointments_id', appointmentId)
      .select()
      .single();
    if (updateErr) throw updateErr;

    try {
      await pushParentNotification({
        userId: current.user_id,
        appointmentId: current.appointments_id,
        type: 'meeting_started',
        title: 'Session started',
        message: 'Your therapist has started the session. You can join now.',
        data: {
          zoomJoinUrl: zoomPayload.zoom_join_url || '',
        },
      });
    } catch (notifErr) {
      console.warn('Parent meeting_started notification failed:', notifErr?.message || notifErr);
    }

    return res.json({ ok: true, message: 'Live session broadcasting.', appointment: updated });
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function deleteMyAppointment(req, res) {
  try {
    const { id } = req.params;
    if (!id || !UUID_RE.test(id)) return res.status(400).json({ message: 'Valid ID required.' });

    const { data, error } = await supabase
      .from('appointments')
      .delete()
      .eq('appointments_id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Appointment not found.' });

    return res.json({ ok: true, message: 'Appointment deleted successfully.', deletedRecord: data });
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}
