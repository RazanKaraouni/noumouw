import supabase from '../config/supabase.js';
import { createZoomMeeting } from './zoom.service.js';

const ZOOM_TZ = () => process.env.ZOOM_TIMEZONE || 'Asia/Beirut';

export function durationMinutesFromAvailability(avail) {
  if (!avail?.start_time || !avail?.end_time) return 60;
  const start = new Date(avail.start_time);
  const end = new Date(avail.end_time);
  const diffMs = end - start;
  return diffMs > 0 ? Math.floor(diffMs / 60000) : 60;
}

export function appointmentStartFromRow(row, availability) {
  if (availability?.start_time) {
    const d = new Date(availability.start_time);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (row?.appointment_date) {
    const d = new Date(row.appointment_date);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Upcoming = start within the last hour or later (matches therapist Meetings panel). */
export function isUpcomingAppointment(row, availability) {
  const start = appointmentStartFromRow(row, availability);
  if (!start) return true;
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  return start >= cutoff;
}

export function applyGeneratedZoomPayload(generated, currentZoom = {}) {
  const joinUrl = generated?.join_url;
  const startUrl = generated?.start_url;
  if (typeof joinUrl === 'string' && joinUrl.trim() && typeof startUrl === 'string' && startUrl.trim()) {
    return {
      zoom_join_url: joinUrl,
      zoom_password: generated.password || null,
      zoom_start_url: startUrl,
      zoom_meeting_id: generated.id,
    };
  }
  if (generated) {
    console.warn('⚠️  Zoom meeting created but join_url or start_url is missing:', generated);
  }
  return {
    zoom_join_url: currentZoom.zoom_join_url ?? null,
    zoom_password: currentZoom.zoom_password ?? null,
    zoom_start_url: currentZoom.zoom_start_url ?? null,
    zoom_meeting_id: currentZoom.zoom_meeting_id ?? null,
  };
}

/**
 * Create a Zoom meeting for a confirmed appointment that has no link yet.
 * @returns {Promise<object|null>} Updated zoom fields, or null if unchanged / failed.
 */
export async function createZoomPayloadForAppointment(row, availability) {
  const currentZoom = {
    zoom_join_url: row.zoom_join_url ?? null,
    zoom_password: row.zoom_password ?? null,
    zoom_start_url: row.zoom_start_url ?? null,
    zoom_meeting_id: row.zoom_meeting_id ?? null,
  };
  if (currentZoom.zoom_join_url) return null;

  const slotStart = availability?.start_time;
  let startTime = slotStart
    ? new Date(slotStart).toISOString()
    : new Date(row.appointment_date).toISOString();

  // Zoom rejects meetings scheduled in the past (common for backfill / same-day starts).
  if (new Date(startTime).getTime() < Date.now()) {
    startTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  }

  const generated = await createZoomMeeting({
    topic: row.notes || 'Therapy Session',
    startTime,
    duration: durationMinutesFromAvailability(availability),
    timezone: ZOOM_TZ(),
  });
  if (!generated) return null;

  const payload = applyGeneratedZoomPayload(generated, currentZoom);
  return payload.zoom_join_url ? payload : null;
}

/**
 * Backfill Zoom links for confirmed upcoming appointments missing zoom_join_url.
 * Mutates rows in place with any newly created Zoom fields.
 */
export async function backfillZoomForAppointments(rows, availabilityById) {
  const candidates = (rows || []).filter((r) => {
    if (String(r.status || '').toLowerCase() !== 'confirmed') return false;
    if (r.zoom_join_url) return false;
    const avail = availabilityById?.[r.availability_id];
    return isUpcomingAppointment(r, avail);
  });

  if (!candidates.length) return;

  await Promise.all(
    candidates.map(async (row) => {
      try {
        const avail = availabilityById?.[row.availability_id];
        const payload = await createZoomPayloadForAppointment(row, avail);
        if (!payload?.zoom_join_url) return;

        const { data: updated, error } = await supabase
          .from('appointments')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('appointments_id', row.appointments_id)
          .select(
            'zoom_join_url, zoom_password, zoom_start_url, zoom_meeting_id, is_started',
          )
          .maybeSingle();

        if (error) throw error;
        if (updated) Object.assign(row, updated);
      } catch (err) {
        console.warn(
          `⚠️  Zoom backfill failed for appointment ${row.appointments_id}:`,
          err?.message || err,
        );
      }
    }),
  );
}
