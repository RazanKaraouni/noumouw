/** Parse YYYY-MM-DD + optional HH:mm into a sortable timestamp. */
export function rowDateTimeMs(dateStr, timeStr) {
  const date = String(dateStr || '').slice(0, 10);
  if (!date) return 0;
  const time = String(timeStr || '00:00').slice(0, 5);
  const ms = new Date(`${date}T${time}:00`).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Return a new array sorted by date (and optional time), ascending or descending. */
export function sortRowsByDate(rows, { dateKey, timeKey, getTime, direction = 'asc' } = {}) {
  const mult = direction === 'desc' ? -1 : 1;
  const timeFor = (row) => (typeof getTime === 'function' ? getTime(row) : timeKey ? row[timeKey] : null);
  return [...rows].sort((a, b) => {
    const ta = rowDateTimeMs(a[dateKey], timeFor(a));
    const tb = rowDateTimeMs(b[dateKey], timeFor(b));
    if (ta !== tb) return (ta - tb) * mult;
    const idA = a.availability_id ?? a.appointments_id ?? 0;
    const idB = b.availability_id ?? b.appointments_id ?? 0;
    return (idA - idB) * mult;
  });
}
