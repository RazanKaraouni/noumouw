import { getUserFacingError } from '../../utils/errorFeedback.js';
import { clampDateNotAfterToday, todayDateInputValue } from '../../utils/dateInput.js';
import { useCallback, useEffect, useState } from 'react';
import { adminModel } from '../../models/adminModel.js';

const panel = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  overflow: 'auto',
};

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font)',
  boxSizing: 'border-box',
};

const selectStyle = { ...inputStyle, cursor: 'pointer', minWidth: 140 };

const th = {
  padding: '12px 14px',
  textAlign: 'left',
  color: 'var(--muted)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
};

const td = { padding: '12px 14px', fontSize: 13, verticalAlign: 'middle' };

const STATUS_STYLES = {
  pending: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  confirmed: { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  completed: { bg: 'rgba(var(--green-rgb),0.12)', color: 'var(--accent)', border: 'rgba(var(--green-rgb),0.35)' },
  cancelled: { bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)', border: 'rgba(239,68,68,0.35)' },
  cancellation_requested: {
    bg: 'rgba(251,191,36,0.1)',
    color: '#fbbf24',
    border: 'rgba(251,191,36,0.25)',
  },
};

function formatDate(raw) {
  if (!raw) return '—';
  try {
    return new Date(`${raw}T12:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(raw);
  }
}

function statusLabel(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase();
  const style = STATUS_STYLES[key] || {
    bg: 'var(--surface2)',
    color: 'var(--muted)',
    border: 'var(--border)',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

export default function AppointmentsOversightPage() {
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [therapistFilter, setTherapistFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (therapistFilter) params.therapist_id = therapistFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const { data } = await adminModel.appointments.list(params);
      setItems(data.items || []);
      setTherapists(data.therapists || []);
      setStatuses(data.statuses || []);
    } catch (err) {
      setError(getUserFacingError(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, therapistFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const clearFilters = () => {
    setStatusFilter('');
    setTherapistFilter('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Appointments oversight</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            Read-only view · {loading ? '…' : `${items.length} appointment${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(var(--green-rgb),0.35)',
            background: 'rgba(var(--green-rgb),0.08)',
            color: 'var(--accent)',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 16,
          alignItems: 'flex-end',
        }}
      >
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {(statuses.length ? statuses : ['pending', 'confirmed', 'completed', 'cancelled', 'cancellation_requested']).map(
              (s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            Therapist
          </label>
          <select
            value={therapistFilter}
            onChange={(e) => setTherapistFilter(e.target.value)}
            style={{ ...selectStyle, minWidth: 180 }}
            aria-label="Filter by therapist"
          >
            <option value="">All therapists</option>
            {therapists.map((t) => (
              <option key={t.therapist_id} value={t.therapist_id}>
                {t.full_name || t.therapist_id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            From date
          </label>
          <input
            type="date"
            value={dateFrom}
            max={todayDateInputValue()}
            onChange={(e) => setDateFrom(clampDateNotAfterToday(e.target.value))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            To date
          </label>
          <input
            type="date"
            value={dateTo}
            max={todayDateInputValue()}
            onChange={(e) => setDateTo(clampDateNotAfterToday(e.target.value))}
            style={inputStyle}
          />
        </div>
        <button
          type="button"
          onClick={clearFilters}
          style={{
            ...inputStyle,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--muted)',
          }}
        >
          Clear filters
        </button>
      </div>

      {error ? (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>
      ) : null}

      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>Legend:</span>
        <StatusBadge status="pending" />
        <StatusBadge status="confirmed" />
        <StatusBadge status="completed" />
        <StatusBadge status="cancelled" />
      </div>

      <div style={panel}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
            No appointments match these filters.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {[
                  'Child Name',
                  'Child Age',
                  'Parent Email',
                  'Therapist Name',
                  'Date',
                  'Status',
                  'Notes',
                ].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.appointments_id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <td style={{ ...td, fontWeight: 600 }}>{row.child_name || '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                    {row.child_age || '—'}
                  </td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{row.parent_email || '—'}</td>
                  <td style={td}>{row.therapist_name || '—'}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{formatDate(row.appointment_date)}</td>
                  <td style={td}>
                    <StatusBadge status={row.status} />
                  </td>
                  <td
                    style={{ ...td, maxWidth: 200, color: 'var(--muted)' }}
                    title={row.notes || ''}
                  >
                    {row.notes
                      ? row.notes.length > 48
                        ? `${row.notes.slice(0, 48)}…`
                        : row.notes
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}