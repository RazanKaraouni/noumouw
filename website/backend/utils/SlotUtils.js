const WORK_START = 9;
const WORK_END = 18;
const DEFAULT_SLOT_DURATION = 60;

export function parseDateParam(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function buildSlotsForDate(date, duration = DEFAULT_SLOT_DURATION) {
  const slots = [];
  for (let hour = WORK_START; hour + duration / 60 <= WORK_END; hour += duration / 60) {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);
    slots.push({ start, end });
  }
  return slots;
}

export function formatSlotLabel(start, end) {
  const fmt = (d) =>
    d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function slotsOverlap(slotStart, slotEnd, apptStart, apptEnd) {
  return apptStart < slotEnd && apptEnd > slotStart;
}

export { WORK_START, WORK_END, DEFAULT_SLOT_DURATION };
