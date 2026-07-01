import {
  meetingWindowStatusForAppointment,
  MEETING_ENDED_MESSAGE,
  MEETING_NOT_REACHED_MESSAGE,
} from '../utils/slotTime.js';

export { MEETING_ENDED_MESSAGE, MEETING_NOT_REACHED_MESSAGE };

/** Host URL preferred; join URL fallback (same as parent app). */
export function therapistZoomUrl(row) {
  const host = String(row?.zoom_start_url || row?.zoomStartUrl || '').trim();
  const join = String(row?.zoom_join_url || row?.zoomJoinUrl || '').trim();
  return host || join || '';
}

export const MEETING_EARLY_START_MS = 10 * 60 * 1000;

/**
 * @returns {{ status: 'ok'|'too_early'|'ended'|'unknown', message?: string }}
 */
export function getMeetingStartWindowStatus(row, now = new Date()) {
  return meetingWindowStatusForAppointment(row, now);
}

export function openTherapistZoom(row) {
  const url = therapistZoomUrl(row);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function mergeAppointmentZoom(row, patch = {}) {
  const appt = patch.appointment || patch;
  return {
    ...row,
    ...appt,
    zoom_join_url: appt.zoom_join_url ?? row.zoom_join_url,
    zoom_start_url: appt.zoom_start_url ?? row.zoom_start_url,
    zoom_password: appt.zoom_password ?? row.zoom_password,
    zoom_meeting_id: appt.zoom_meeting_id ?? row.zoom_meeting_id,
    is_started: appt.is_started ?? row.is_started ?? true,
  };
}
