import supabase from '../config/supabase.js';
import { getTherapistsDirectory } from '../models/therapistModel.js';
import { apiCache } from '../utils/ttlCache.js';
import { getTherapistId } from '../utils/authContext.js';
import { sendParentDecisionEmail } from '../services/email.service.js';
import { createZoomMeeting } from '../services/zoom.service.js';
import { 
  sendNotification, 
  THERAPIST_NOTIFICATION_TYPES 
} from '../services/notificationService.js';

// Regex utility for validation
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper functions for parsing timestamps
export function toDateFromTs(raw) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw ?? '').slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export { formatSlotHm as hm } from '../utils/slotTime.js';

export function durationMinutesFromAvailability(avail) {
  if (!avail || !avail.start_time || !avail.end_time) return 60;
  const start = new Date(avail.start_time);
  const end = new Date(avail.end_time);
  const diffMs = end - start;
  return diffMs > 0 ? Math.floor(diffMs / 60000) : 60;
}

// Internal child bundle dynamic data fetch helper
export async function loadTherapistChildBundle({ therapistId, childId, appointmentContext }) {
  const { data: childData, error: childErr } = await supabase
    .from('children')
    .select('*, milestones:milestone_tracking(*)')
    .eq('children_id', childId)
    .maybeSingle();

  if (childErr) throw childErr;
  return {
    ...childData,
    context_appointment: appointmentContext
  };
}

// Hook placeholder helper for managing relationship access link records
export async function upsertTherapistChildLink({ therapistId, appointmentsId, userId, childId }) {
  await supabase
    .from('therapist_children')
    .upsert({
      therapist_id: therapistId,
      child_id: childId,
      associated_appointment_id: appointmentsId,
      parent_user_id: userId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'therapist_id,child_id' });
}

// Internal direct notification to target parent channel hook
export async function notifyParent({ userId, appointmentId, type, title, message }) {
  await sendNotification({
    recipientId: userId,
    type: type,
    title: title,
    message: message,
    data: { appointmentId }
  });
}

/**
 * Main Controller Handler Implementations
 */

// ADDED: Missing controller export required by server.js
// Therapist contact PII (email, phone, address) is gated behind JWT auth — only
// authenticated parents and admins may call GET /api/therapists-directory.
export async function listTherapistsDirectory(req, res) {
  try {
    const data = await apiCache.getOrSet(
      'therapists:directory',
      5 * 60 * 1000,
      () => getTherapistsDirectory(),
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching therapist directory:', error);
    return res.status(500).json({ message: 'Internal server failure retrieving directory.' });
  }
}

export async function updateAppointmentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status: nextStatus, remarks } = req.body;
    const therapistId = getTherapistId(req);

    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({ message: 'Invalid assignment format.' });
    }

    const { data: current, error: checkErr } = await supabase
      .from('appointments')
      .select('*, availability:availability_id(*)')
      .eq('appointments_id', id)
      .single();

    if (checkErr || !current) {
      return res.status(404).json({ message: 'Appointment item tracking matching target was missing.' });
    }

    const childId = current.child_id;

    let zoomPayload = {
      zoom_join_url: current.zoom_join_url,
      zoom_password: current.zoom_password,
      zoom_start_url: current.zoom_start_url,
      zoom_meeting_id: current.zoom_meeting_id,
    };

    if (nextStatus === 'confirmed' && !zoomPayload.zoom_join_url) {
      try {
        const generated = await createZoomMeeting({
          topic: current.notes || 'Therapy Session',
          startTime: new Date(current.appointment_date).toISOString(),
          duration: durationMinutesFromAvailability(current.availability),
          timezone: 'Asia/Beirut',
        });
        if (generated) {
          zoomPayload = {
            zoom_join_url: generated.join_url,
            zoom_password: generated.password || null,
            zoom_start_url: generated.start_url,
            zoom_meeting_id: generated.id,
          };
        }
      } catch (zoomErr) {
        console.error('⚠️ [zoom] Credentials disabled or offline. Saving status without link:', zoomErr.message);
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

    const [therapistRow, parentRow, childRow] = await Promise.all([
      supabase.from('therapists').select('full_name').eq('therapist_id', current.therapist_id).maybeSingle(),
      supabase.from('parents').select('full_name, email').eq('user_id', current.user_id).maybeSingle(),
      childId ? supabase.from('children').select('full_name').eq('children_id', childId).maybeSingle() : Promise.resolve(null)
    ]);

    const p = parentRow?.data || {};
    const t = therapistRow?.data || {};
    const c = childRow?.data || {};
    const parentName = (p.full_name || '').trim() || 'Parent';
    const therapistName = (t.full_name || '').trim() || 'Therapist';
    const childName = (c.full_name || '').trim() || 'your child';
    const appointmentDate = current.appointment_date || toDateFromTs(current.availability?.start_time);
    const startHm = hm(current.availability?.start_time);
    const endHm = hm(current.availability?.end_time);
    const appointmentTime = startHm && endHm ? `${startHm} – ${endHm}` : startHm || endHm || 'Unknown time';
    const decisionWord = nextStatus === 'confirmed' ? 'confirmed' : 'cancelled';
    const body = `Hello ${parentName}, your appointment is ${decisionWord} with ${therapistName} on ${appointmentDate} from ${appointmentTime} for ${childName}.`;

    let notificationCreated = false;
    try {
      const notifType = nextStatus === 'confirmed' ? 'appointment_confirmed' : 'appointment_cancelled';
      const notifTitle = nextStatus === 'confirmed' ? 'Appointment confirmed' : 'Appointment cancelled';
      await notifyParent({
        userId: current.user_id,
        appointmentId: current.appointments_id,
        type: notifType,
        title: notifTitle,
        message: body,
      });
      notificationCreated = true;
    } catch (notifErr) {
      console.error('Notification insert failed:', notifErr?.message || notifErr);
    }

    let emailSent = false;
    try {
      emailSent = await sendParentDecisionEmail({
        toEmail: p.email,
        parentName,
        therapistName,
        appointmentDate,
        appointmentTime,
        childName,
        action: nextStatus,
      });
    } catch (emailErr) {
      console.error('Parent decision email failed:', emailErr?.message || emailErr);
    }

    // FIXED: Closed out the final condition block cleanly
    if (nextStatus === 'confirmed' && childId != null) {
      try {
        await upsertTherapistChildLink({
          therapistId: current.therapist_id,
          appointmentsId: current.appointments_id,
          userId: current.user_id,
          childId: childId
        });
      } catch (linkErr) {
        console.error('Link record creation failed:', linkErr?.message || linkErr);
      }
    }

    return res.status(200).json({
      success: true,
      data: updated,
      meta: { emailSent, notificationCreated }
    });

  } catch (error) {
    console.error('Controller system failure:', error);
    return res.status(500).json({ message: 'Internal server tracking failure.' });
  }
}
