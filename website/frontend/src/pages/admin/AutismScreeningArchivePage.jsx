import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useEffect, useMemo, useState } from 'react';
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
import { adminModel } from '../../models/adminModel.js';

const panel = {
  background: 'var(--surface-gradient)',
  color: 'var(--text)',
  boxShadow: 'var(--shadow-sm)',
  borderRadius: 14,
  padding: 20,
};

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font)',
};

const RISK_COLORS = {
  low: 'var(--accent)',
  medium: '#fbbf24',
  high: 'var(--danger)',
};

function normalizeRisk(level) {
  const n = String(level || '').toLowerCase();
  if (n === 'low') return 'low';
  if (n === 'high') return 'high';
  if (n === 'moderate' || n === 'medium') return 'medium';
  return 'other';
}

function buildChartData(rows) {
  const byPeriod = new Map();

  for (const row of rows) {
    if (!row.created_at) continue;
    const date = new Date(row.created_at);
    if (Number.isNaN(date.getTime())) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

    if (!byPeriod.has(key)) {
      byPeriod.set(key, { key, label, total: 0, low: 0, medium: 0, high: 0, other: 0 });
    }

    const bucket = byPeriod.get(key);
    bucket.total += 1;
    const risk = normalizeRisk(row.risk_level);
    bucket[risk] += 1;
  }

  return [...byPeriod.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function ScreeningTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 12,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div>Total screenings: <strong>{row?.total ?? 0}</strong></div>
      {row?.low ? <div style={{ color: RISK_COLORS.low }}>Low: {row.low}</div> : null}
      {row?.medium ? <div style={{ color: RISK_COLORS.medium }}>Moderate: {row.medium}</div> : null}
      {row?.high ? <div style={{ color: RISK_COLORS.high }}>High: {row.high}</div> : null}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        minWidth: 120,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: color || 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

export default function AutismScreeningArchivePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    adminModel.reports
      .screeningArchive(riskFilter !== 'all' ? { risk_level: riskFilter } : {})
      .then((r) => {
        if (!cancelled) setRows(Array.isArray(r.data) ? r.data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getUserFacingError(err));
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [riskFilter]);

  const counts = useMemo(() => {
    const c = { low: 0, medium: 0, high: 0 };
    for (const row of rows) {
      const risk = normalizeRisk(row.risk_level);
      if (risk === 'low') c.low += 1;
      else if (risk === 'high') c.high += 1;
      else if (risk === 'medium') c.medium += 1;
    }
    return c;
  }, [rows]);

  const chartData = useMemo(() => buildChartData(rows), [rows]);

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
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            Clinical Reports Archive
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', margin: '6px 0 0' }}>
            Autism Screening Reports
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            Number of autism screenings completed over time
          </p>
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer', minWidth: 140 }}
          aria-label="Filter by risk level"
        >
          <option value="all">All risk levels</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium / Moderate</option>
          <option value="High">High</option>
        </select>
      </div>

      {error ? (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <StatCard label="Total screenings" value={loading ? '—' : rows.length} />
        <StatCard label="Low risk" value={loading ? '—' : counts.low} color={RISK_COLORS.low} />
        <StatCard label="Moderate" value={loading ? '—' : counts.medium} color={RISK_COLORS.medium} />
        <StatCard label="High risk" value={loading ? '—' : counts.high} color={RISK_COLORS.high} />
      </div>

      <div style={panel}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Screenings per month</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
          Bars show how many screenings were completed each month, stacked by risk level.
        </p>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
        ) : chartData.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
            No autism screening results match this filter.
          </div>
        ) : (
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: 'Screenings',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--muted)',
                    fontSize: 11,
                  }}
                />
                <Tooltip content={<ScreeningTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  formatter={(value) => {
                    if (value === 'low') return 'Low';
                    if (value === 'medium') return 'Moderate';
                    if (value === 'high') return 'High';
                    return value;
                  }}
                />
                <Bar dataKey="low" stackId="risk" fill={RISK_COLORS.low} name="low" radius={[0, 0, 0, 0]} />
                <Bar dataKey="medium" stackId="risk" fill={RISK_COLORS.medium} name="medium" />
                <Bar dataKey="high" stackId="risk" fill={RISK_COLORS.high} name="high" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}