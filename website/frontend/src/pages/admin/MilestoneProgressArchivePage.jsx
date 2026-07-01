import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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

function buildChartData(reports) {
  const byPeriod = new Map();

  for (const row of reports) {
    if (!row.created_at) continue;
    const date = new Date(row.created_at);
    if (Number.isNaN(date.getTime())) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

    if (!byPeriod.has(key)) {
      byPeriod.set(key, { key, label, total: 0 });
    }
    byPeriod.get(key).total += 1;
  }

  return [...byPeriod.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function MilestoneTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const count = payload[0]?.value ?? 0;
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
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div>
        Reports generated: <strong>{count}</strong>
      </div>
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

export default function MilestoneProgressArchivePage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminModel.reports
      .milestoneArchive()
      .then((r) => {
        setReports(r.data?.reports || []);
        setError('');
      })
      .catch((err) => {
        setError(getUserFacingError(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => buildChartData(reports), [reports]);

  const uniqueChildrenInReports = useMemo(() => {
    const ids = new Set();
    for (const r of reports) {
      if (r.child_id != null) ids.add(r.child_id);
    }
    return ids.size;
  }, [reports]);

  if (loading) {
    return <div style={{ color: 'var(--muted)' }}>Loading milestone archive…</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
          Clinical Reports Archive
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', margin: '6px 0 0' }}>
          Milestone Progress Reports
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
          Number of milestone tracking reports generated over time
        </p>
      </div>

      {error ? (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <StatCard label="Total reports" value={reports.length} />
        <StatCard
          label="Children in reports"
          value={uniqueChildrenInReports}
          color="var(--accent)"
        />
      </div>

      <div style={panel}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Reports per month</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
          Each bar shows how many milestone progress reports were saved that month.
        </p>

        {chartData.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
            No milestone progress reports in the archive yet.
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
                    value: 'Reports',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--muted)',
                    fontSize: 11,
                  }}
                />
                <Tooltip content={<MilestoneTooltip />} />
                <Bar
                  dataKey="total"
                  fill="var(--accent)"
                  name="Reports"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}