import { PAYMENT_STATUSES } from '../components/payments/SessionPaymentsTable.jsx';

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekKey(date) {
  return toYmd(startOfWeek(date));
}

function weekLabel(date) {
  const start = startOfWeek(date);
  return start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(date) {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function paymentDate(row) {
  const raw = row.paid_at || row.created_at || row.appointment_date;
  if (!raw) return null;
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function rangeCutoff(range) {
  if (range === 'all') return null;
  const now = new Date();
  const days = range === '90d' ? 90 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

/** Group payments into week or month buckets with counts per status. */
export function buildPaymentStatusTrend(payments, { groupBy = 'week', range = '90d' } = {}) {
  const list = Array.isArray(payments) ? payments : [];
  const cutoff = rangeCutoff(range);
  const buckets = new Map();

  for (const row of list) {
    const dt = paymentDate(row);
    if (!dt) continue;
    if (cutoff && dt < cutoff) continue;

    const key = groupBy === 'month' ? monthKey(dt) : weekKey(dt);
    const label = groupBy === 'month' ? monthLabel(dt) : weekLabel(dt);

    if (!buckets.has(key)) {
      const empty = { key, label };
      for (const status of PAYMENT_STATUSES) empty[status] = 0;
      buckets.set(key, empty);
    }

    const bucket = buckets.get(key);
    const status = String(row.status || 'pending').toLowerCase();
    if (PAYMENT_STATUSES.includes(status)) {
      bucket[status] += 1;
    }
  }

  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}
