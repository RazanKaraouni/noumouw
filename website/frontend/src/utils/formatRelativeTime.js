const UNITS = [
  { max: 60, divisor: 1, unit: 'second' },
  { max: 3600, divisor: 60, unit: 'minute' },
  { max: 86400, divisor: 3600, unit: 'hour' },
  { max: 604800, divisor: 86400, unit: 'day' },
  { max: 2592000, divisor: 604800, unit: 'week' },
  { max: 31536000, divisor: 2592000, unit: 'month' },
  { max: Infinity, divisor: 31536000, unit: 'year' },
];

function plural(n, unit) {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

/**
 * @param {string|number|Date|null|undefined} raw
 * @returns {{ relative: string, full: string }}
 */
export function formatRelativeTime(raw) {
  if (!raw) return { relative: '—', full: '—' };
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return { relative: '—', full: '—' };

  const full = date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return { relative: 'just now', full };

  for (const { max, divisor, unit } of UNITS) {
    if (sec < max) {
      const n = Math.max(1, Math.floor(sec / divisor));
      return { relative: plural(n, unit), full };
    }
  }
  return { relative: full, full };
}
