import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PAYMENT_STATUSES } from './SessionPaymentsTable.jsx';
import { buildPaymentStatusTrend } from '../../utils/paymentChartData.js';

const panel = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  background: 'var(--surface)',
  padding: 16,
  marginBottom: 20,
};

const CHART_GRID = 'rgba(148,163,184,0.25)';
const CHART_AXIS = 'var(--muted)';

const STATUS_COLORS = {
  pending: '#fbbf24',
  paid: 'var(--accent)',
  waived: '#60a5fa',
  refunded: '#fb923c',
  failed: '#ef4444',
};

function statusLabel(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Toggle({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: active
                ? '1px solid rgba(var(--green-rgb),0.35)'
                : '1px solid var(--border)',
              background: active ? 'rgba(var(--green-rgb),0.12)' : 'var(--surface2)',
              color: active ? 'var(--accent)' : 'var(--muted)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PaymentStatusTrendChart({ items, loading }) {
  const [groupBy, setGroupBy] = useState('week');
  const range = '90d';

  const chartData = useMemo(
    () => buildPaymentStatusTrend(items, { groupBy, range }),
    [items, groupBy, range],
  );

  const activeStatuses = useMemo(
    () =>
      PAYMENT_STATUSES.filter((status) =>
        chartData.some((row) => Number(row[status]) > 0),
      ),
    [chartData],
  );

  const rangeLabel = 'Last 90 days';

  return (
    <div style={panel}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
            Payment status comparison
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Count of session payments grouped by status · {rangeLabel.toLowerCase()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Toggle
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { key: 'week', label: 'By week' },
              { key: 'month', label: 'By month' },
            ]}
          />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid rgba(var(--green-rgb),0.35)',
              background: 'rgba(var(--green-rgb),0.12)',
              color: 'var(--accent)',
              whiteSpace: 'nowrap',
            }}
          >
            90d
          </span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            height: 260,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'rgba(2,6,23,0.25)',
            opacity: 0.55,
          }}
        />
      ) : !chartData.length ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No payment data for this period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 10 }} tickLine={false} />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={statusLabel} />
            {activeStatuses.map((status) => (
              <Bar
                key={status}
                dataKey={status}
                name={status}
                stackId="payments"
                fill={STATUS_COLORS[status]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
