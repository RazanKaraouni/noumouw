const panel = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  overflow: 'auto',
  background: 'var(--surface)',
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

const PAYMENT_STATUS_STYLES = {
  pending: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  paid: { bg: 'rgba(var(--green-rgb),0.12)', color: 'var(--accent)', border: 'rgba(var(--green-rgb),0.35)' },
  waived: { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  refunded: { bg: 'rgba(251,146,60,0.14)', color: '#fb923c', border: 'rgba(251,146,60,0.35)' },
  failed: { bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)', border: 'rgba(239,68,68,0.35)' },
};

export const PAYMENT_STATUSES = ['pending', 'paid', 'waived', 'refunded', 'failed'];

function formatDate(raw) {
  if (!raw) return '—';
  try {
    return new Date(`${String(raw).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(raw) {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatMoney(amount, currency = 'USD') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function statusLabel(status) {
  return String(status || '—')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PaymentStatusBadge({ status }) {
  const key = String(status || '').toLowerCase();
  const style = PAYMENT_STATUS_STYLES[key] || {
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

export default function SessionPaymentsTable({
  items,
  loading,
  error,
  role = 'therapist',
  statusFilter,
  onStatusFilterChange,
  therapistFilter,
  onTherapistFilterChange,
  therapists = [],
  onRefresh,
}) {
  const showTherapistColumn = role === 'admin';

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
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Session payments</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            {loading ? 'Loading…' : `${items.length} payment${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
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

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.08)',
            color: '#fca5a5',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

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
            Payment status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            style={selectStyle}
            aria-label="Filter by payment status"
          >
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {showTherapistColumn ? (
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Therapist
            </label>
            <select
              value={therapistFilter}
              onChange={(e) => onTherapistFilterChange(e.target.value)}
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
        ) : null}
      </div>

      <div style={panel}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={th}>Session date</th>
              {showTherapistColumn ? <th style={th}>Therapist</th> : null}
              <th style={th}>Parent</th>
              <th style={th}>Child</th>
              <th style={th}>Amount</th>
              <th style={th}>Payment status</th>
              <th style={th}>Paid at</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={showTherapistColumn ? 7 : 6} style={{ ...td, color: 'var(--muted)' }}>
                  Loading payments…
                </td>
              </tr>
            ) : null}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={showTherapistColumn ? 7 : 6} style={{ ...td, color: 'var(--muted)' }}>
                  No session payments found.
                </td>
              </tr>
            ) : null}
            {!loading
              ? items.map((row) => (
                  <tr key={row.payment_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>{formatDate(row.appointment_date)}</td>
                    {showTherapistColumn ? (
                      <td style={td}>{row.therapist_name || '—'}</td>
                    ) : null}
                    <td style={td}>
                      <div>{row.parent_name || '—'}</div>
                      {row.parent_email ? (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {row.parent_email}
                        </div>
                      ) : null}
                    </td>
                    <td style={td}>{row.child_name || '—'}</td>
                    <td style={td}>{formatMoney(row.amount, row.currency)}</td>
                    <td style={td}>
                      <PaymentStatusBadge status={row.status} />
                    </td>
                    <td style={td}>{formatDateTime(row.paid_at)}</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
