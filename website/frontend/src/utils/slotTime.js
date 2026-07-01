/**
 * Wall-clock slot times in the app timezone (matches backend utils/slotTime.js).
 */

const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'Asia/Beirut';

export const SLOT_DAYTIME_MESSAGE =
  'Availability slots must be between 8:00 AM and 8:00 PM.';
export const SLOT_END_BEFORE_START_MESSAGE = 'End time must be after start time.';
export const SLOT_TIME_CONFLICT_MESSAGE =
  'A slot on this date already uses that start or end time. Choose a different time.';
export const SLOT_DATE_NOT_ALLOWED_MESSAGE =
  'Availability cannot be scheduled for a past date.';
export const SLOT_DATE_TODAY_NOT_ALLOWED_MESSAGE =
  'Add slots from tomorrow onward. You cannot add availability for today.';
export const SLOT_DATE_MAX_YEARS_AHEAD = 2;

export const MEETING_EARLY_START_MINUTES = 10;
export const MEETING_NOT_REACHED_MESSAGE = 'Meeting time is not reached yet.';
export const MEETING_ENDED_MESSAGE = 'Meeting has ended.';

function normalizeTime(raw) {
  const t = String(raw ?? '').trim();
  if (t.length === 5 && t.includes(':')) return `${t}:00`;
  return t;
}

export function formatSlotHm(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw);
  const isoMatch = s.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

export function timeToSeconds(raw) {
  const t = normalizeTime(raw);
  const parts = String(t).split(':');
  if (parts.length < 2) return Number.NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = Number(parts[2] ?? '0');
  if ([h, m, s].some(Number.isNaN)) return Number.NaN;
  return h * 3600 + m * 60 + s;
}

const SLOT_DAY_OPEN_SEC = 8 * 3600;
const SLOT_DAY_CLOSE_SEC = 20 * 3600;

function isWithinDaytimeHours(timeValue) {
  const sec = timeToSeconds(timeValue);
  if (Number.isNaN(sec)) return false;
  return sec >= SLOT_DAY_OPEN_SEC && sec <= SLOT_DAY_CLOSE_SEC;
}

export function validateSlotTimeRange(startTime, endTime) {
  const startSec = timeToSeconds(startTime);
  const endSec = timeToSeconds(endTime);
  if (Number.isNaN(startSec) || Number.isNaN(endSec)) {
    return { ok: false, message: 'Enter valid start and end times.' };
  }
  if (!isWithinDaytimeHours(startTime) || !isWithinDaytimeHours(endTime)) {
    return { ok: false, message: SLOT_DAYTIME_MESSAGE };
  }
  if (endSec <= startSec) {
    return { ok: false, message: SLOT_END_BEFORE_START_MESSAGE };
  }
  return { ok: true };
}

/** True when two same-day ranges share any wall-clock minute. */
export function slotRangesOverlap(startA, endA, startB, endB) {
  const a0 = timeToSeconds(startA);
  const a1 = timeToSeconds(endA);
  const b0 = timeToSeconds(startB);
  const b1 = timeToSeconds(endB);
  if ([a0, a1, b0, b1].some(Number.isNaN)) return false;
  return a0 < b1 && b0 < a1;
}

/**
 * Reject when a new slot reuses a start/end time or overlaps an existing slot on the same date.
 * @param {Array<{ availability_id?: string, slot_date?: string, start_time?: string, end_time?: string }>} existingSlots
 */
export function validateSlotAgainstExisting(
  existingSlots,
  slotDate,
  startTime,
  endTime,
  excludeId = null,
) {
  const dateStr = String(slotDate || '').trim().slice(0, 10);
  const newStart = timeToSeconds(startTime);
  const newEnd = timeToSeconds(endTime);
  if (Number.isNaN(newStart) || Number.isNaN(newEnd)) {
    return { ok: true };
  }

  for (const slot of existingSlots || []) {
    if (excludeId != null && slot.availability_id === excludeId) continue;
    const existingDate = String(slot.slot_date || '').trim().slice(0, 10);
    if (existingDate !== dateStr) continue;

    const exStart = timeToSeconds(slot.start_time);
    const exEnd = timeToSeconds(slot.end_time);
    if (Number.isNaN(exStart) || Number.isNaN(exEnd)) continue;

    const timeAlreadyUsed =
      newStart === exStart ||
      newStart === exEnd ||
      newEnd === exStart ||
      newEnd === exEnd;
    if (timeAlreadyUsed || slotRangesOverlap(startTime, endTime, slot.start_time, slot.end_time)) {
      return { ok: false, message: SLOT_TIME_CONFLICT_MESSAGE };
    }
  }

  return { ok: true };
}

function addDaysToDateString(dateStr, days) {
  const base = String(dateStr || '').slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return base;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getNowWallClockInAppTz(reference = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(reference)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function validateSlotDate(slotDate, reference = new Date()) {
  const dateStr = String(slotDate || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, message: 'Choose a date.' };
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const probe = new Date(`${dateStr}T12:00:00`);
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getFullYear() !== y ||
    probe.getMonth() + 1 !== m ||
    probe.getDate() !== d
  ) {
    return { ok: false, message: 'Enter a valid calendar date.' };
  }

  const now = getNowWallClockInAppTz(reference);
  const currentYear = Number(now.date.slice(0, 4));
  const maxYear = currentYear + SLOT_DATE_MAX_YEARS_AHEAD;
  if (y < currentYear || y > maxYear) {
    return {
      ok: false,
      message: `Enter a valid date. The year must be between ${currentYear} and ${maxYear}.`,
    };
  }

  if (dateStr < now.date) {
    return { ok: false, message: SLOT_DATE_NOT_ALLOWED_MESSAGE };
  }

  if (dateStr === now.date) {
    return { ok: false, message: SLOT_DATE_TODAY_NOT_ALLOWED_MESSAGE };
  }

  return { ok: true, dateStr };
}

export function minSlotDateInputValue(reference = new Date()) {
  const today = getNowWallClockInAppTz(reference).date;
  return addDaysToDateString(today, 1);
}

export function maxSlotDateInputValue(reference = new Date()) {
  const now = getNowWallClockInAppTz(reference);
  const maxYear = Number(now.date.slice(0, 4)) + SLOT_DATE_MAX_YEARS_AHEAD;
  return `${maxYear}-12-31`;
}

function compareWallClockPoints(a, b) {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  return a.sec - b.sec;
}

function wallClockPoint(dateStr, timeHm) {
  const sec = timeToSeconds(formatSlotHm(timeHm) || String(timeHm || '').slice(0, 8));
  if (Number.isNaN(sec)) return null;
  return { date: String(dateStr || '').slice(0, 10), sec };
}

/**
 * @returns {{ status: 'ok'|'too_early'|'ended'|'unknown', message?: string }}
 */
export function getMeetingStartWindowStatus(
  { appointmentDate, startTimeHm, endTimeHm },
  reference = new Date(),
  earlyMinutes = MEETING_EARLY_START_MINUTES,
) {
  const dateStr = String(appointmentDate || '').trim().slice(0, 10);
  const startPoint = wallClockPoint(dateStr, startTimeHm);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !startPoint) {
    return { status: 'unknown' };
  }

  const startSec = startPoint.sec;
  let endPoint = wallClockPoint(dateStr, endTimeHm);
  if (!endPoint) {
    endPoint = { date: dateStr, sec: startSec + 3600 };
  } else if (compareWallClockPoints(endPoint, startPoint) <= 0) {
    endPoint = { date: addDaysToDateString(dateStr, 1), sec: endPoint.sec };
  }

  let earliestDate = dateStr;
  let earliestSec = startSec - earlyMinutes * 60;
  if (earliestSec < 0) {
    earliestSec += 86400;
    earliestDate = addDaysToDateString(dateStr, -1);
  }
  const earliestPoint = { date: earliestDate, sec: earliestSec };

  const now = getNowWallClockInAppTz(reference);
  const nowPoint = { date: now.date, sec: timeToSeconds(now.time) };

  if (compareWallClockPoints(nowPoint, endPoint) > 0) {
    return { status: 'ended', message: MEETING_ENDED_MESSAGE };
  }
  if (compareWallClockPoints(nowPoint, earliestPoint) < 0) {
    return { status: 'too_early', message: MEETING_NOT_REACHED_MESSAGE };
  }
  return { status: 'ok' };
}

/** Normalize an appointment row for meeting-window checks. */
export function meetingWindowStatusForAppointment(row, reference = new Date()) {
  return getMeetingStartWindowStatus(
    {
      appointmentDate: String(row?.appointment_date || '').slice(0, 10),
      startTimeHm: row?.appointment_start_time || row?.appointment_time,
      endTimeHm: row?.appointment_end_time,
    },
    reference,
  );
}
