import supabase from '../config/supabase.js';
import { notifyParent } from './notificationService.js';
import { formatSlotHm, getAppTimeZone } from '../utils/slotTime.js';

const REMINDER_MINUTES = Math.max(
  5,
  Number(process.env.APPOINTMENT_REMINDER_MINUTES) || 60,
);
const CHECK_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.APPOINTMENT_REMINDER_CHECK_MS) || 5 * 60_000,
);
const REMINDER_WINDOW_MINUTES = 5;

function parseStartMs(raw) {
  if (raw == null || raw === '') return Number.NaN;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? Number.NaN : ms;
}

async function reminderAlreadySent(appointmentId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id')
    .eq('appointment_id', appointmentId)
    .eq('type', 'session_reminder')
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

async function runAppointmentReminders() {
  const now = Date.now();
  const targetMs = now + REMINDER_MINUTES * 60_000;
  const windowStart = targetMs - REMINDER_WINDOW_MINUTES * 60_000;
  const windowEnd = targetMs + REMINDER_WINDOW_MINUTES * 60_000;

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(
      'appointments_id, user_id, appointment_date, status, is_started, availability:availability_id(start_time, end_time)',
    )
    .eq('status', 'confirmed')
    .eq('is_started', false);

  if (error) {
    console.error('[appointmentReminder] load failed:', error.message);
    return;
  }

  for (const appt of appointments || []) {
    const startMs = parseStartMs(appt.availability?.start_time);
    if (Number.isNaN(startMs)) continue;
    if (startMs < windowStart || startMs > windowEnd) continue;

    try {
      if (await reminderAlreadySent(appt.appointments_id)) continue;

      const startLabel = formatSlotHm(appt.availability?.start_time) || 'soon';
      const dateLabel = appt.appointment_date || '';

      await notifyParent({
        userId: appt.user_id,
        appointmentId: appt.appointments_id,
        type: 'session_reminder',
        title: 'Upcoming session',
        message: `Reminder: your therapy session is in about ${REMINDER_MINUTES} minutes (${dateLabel} at ${startLabel}, ${getAppTimeZone()}).`,
      });
      console.log('[appointmentReminder] sent →', appt.appointments_id);
    } catch (err) {
      console.error('[appointmentReminder] notify failed:', err?.message || err);
    }
  }
}

/** Poll for confirmed sessions starting in ~APPOINTMENT_REMINDER_MINUTES. */
export function startAppointmentReminderScheduler() {
  const tick = () => {
    runAppointmentReminders().catch((err) => {
      console.error('[appointmentReminder] tick error:', err?.message || err);
    });
  };

  tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();

  console.log(
    `[appointmentReminder] scheduler started (${REMINDER_MINUTES} min before session, every ${CHECK_INTERVAL_MS / 1000}s)`,
  );
}
