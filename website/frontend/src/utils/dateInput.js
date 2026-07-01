/** YYYY-MM-DD for native `<input type="date">` max/min attributes. */
export function todayDateInputValue(reference = new Date()) {
  const d = reference instanceof Date ? reference : new Date(reference);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Prevent filter dates after today (manual entry or picker). */
export function clampDateNotAfterToday(value, reference = new Date()) {
  const today = todayDateInputValue(reference);
  const dateStr = String(value || '').trim().slice(0, 10);
  if (!dateStr) return '';
  return dateStr > today ? today : dateStr;
}
