import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOverviewStats } from '../../hooks/useOverviewStats';
import ReportNotificationBell from '../../components/admin/ReportNotificationBell';
import { AdminAlert } from '../../components/admin/ui';
import { useAuth } from '../../context/AuthContext';
import { isNewReport, loadSeenReportIds } from '../../utils/seenReportIds.js';

const pageHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 8,
};

const panelStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
};

/** Shared chart height for overview analytics cards. */
const ANALYTICS_BODY_MIN_HEIGHT = 240;
/** Minimum full card height (header + padding + chart body). */
const OVERVIEW_ANALYTICS_CARD_MIN_HEIGHT = ANALYTICS_BODY_MIN_HEIGHT + 120;
const OVERVIEW_GROWTH_RANGE = '90d';
const OVERVIEW_TREND_GROUP_OPTIONS = [
  { key: 'week', label: 'By week' },
  { key: 'month', label: 'By month' },
];
const OVERVIEW_GROWTH_RANGE_LABEL = 'Last 90 days';

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function safeFirstName(admin) {
  const raw = admin?.full_name || admin?.firstName || admin?.name || '';
  const first = String(raw).trim().split(' ')[0];
  return first || 'Admin';
}

const UNASSIGNED_THERAPIST_LABEL = 'Unassigned Provider';

function normalizeTherapistChartName(rawName) {
  const name = String(rawName ?? '').trim();
  if (
    !name ||
    /^unknown$/i.test(name) ||
    /^unassigned$/i.test(name) ||
    /^n\/a$/i.test(name) ||
    /^therapist$/i.test(name)
  ) {
    return UNASSIGNED_THERAPIST_LABEL;
  }
  return name;
}

/** Short Y-axis label for horizontal bar charts (first token, with safe fallback). */
function chartTherapistAxisLabel(rawName) {
  const full = normalizeTherapistChartName(rawName);
  if (full === UNASSIGNED_THERAPIST_LABEL) {
    return 'Unassigned';
  }
  return full.split(/\s+/)[0] || UNASSIGNED_THERAPIST_LABEL;
}

function mapTherapistBarRow(entry, valueKey) {
  const fullName = normalizeTherapistChartName(entry?.fullName);
  return {
    name: chartTherapistAxisLabel(fullName),
    fullName,
    [valueKey]: entry?.[valueKey] ?? 0,
  };
}

function TherapistBarTooltip({ active, payload, valueLabel }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 12,
        padding: '8px 10px',
      }}
    >
      <div style={{ fontWeight: 700 }}>{row?.fullName || UNASSIGNED_THERAPIST_LABEL}</div>
      <div style={{ color: 'var(--muted)', marginTop: 4 }}>
        {valueLabel}: {payload[0]?.value ?? 0}
      </div>
    </div>
  );
}

function toLabelCase(input) {
  const s = String(input || '').trim();
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const skeletonStyle = {
  animation: 'overview-pulse 1.2s ease-in-out infinite',
  opacity: 0.55,
};

function Badge({ tone, children }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
  };

  switch (tone) {
    case 'success':
      return (
        <span style={{ ...base, background: 'rgba(var(--green-rgb),0.12)', color: 'var(--accent)', borderColor: 'rgba(var(--green-rgb),0.35)' }}>
          {children}
        </span>
      );
    case 'warning':
      return (
        <span style={{ ...base, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.35)' }}>
          {children}
        </span>
      );
    case 'danger':
      return (
        <span style={{ ...base, background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.35)' }}>
          {children}
        </span>
      );
    default:
      return <span style={base}>{children}</span>;
  }
}

function SectionCard({ title, subtitle, right, children, fill = false, compact = false, className = '' }) {
  return (
    <section
      className={`${fill ? 'overview-section-card overview-section-card--fill' : 'overview-section-card'} ${className}`.trim()}
      style={{
        ...panelStyle,
        padding: compact ? '14px 16px' : '16px 18px',
        ...(fill
          ? {
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }
          : {}),
      }}
    >
      <div className="overview-section-card__header">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, letterSpacing: '-0.2px' }}>{title}</h2>
          {subtitle ? (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="overview-section-card__actions">{right}</div> : null}
      </div>
      <div
        className={fill ? 'overview-section-card__body' : undefined}
        style={
          fill
            ? {
                flex: 1,
                minHeight: ANALYTICS_BODY_MIN_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
              }
            : undefined
        }
      >
        {children}
      </div>
    </section>
  );
}

function PrimaryButton({ children, onClick, disabled, tone }) {
  const base = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    fontSize: 12,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontFamily: 'var(--font)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  if (tone === 'accent') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        style={{ ...base, borderColor: 'rgba(var(--green-rgb),0.35)', color: 'var(--accent)', background: 'rgba(var(--green-rgb),0.08)' }}
      >
        {children}
      </button>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ ...base, color: 'var(--muted)', background: 'var(--surface2)' }}>
      {children}
    </button>
  );
}

function FlagQueue({ reports }) {
  const [seenIds, setSeenIds] = useState(loadSeenReportIds);

  useEffect(() => {
    const sync = () => setSeenIds(loadSeenReportIds());
    window.addEventListener('noumow-seen-reports-changed', sync);
    return () => window.removeEventListener('noumow-seen-reports-changed', sync);
  }, []);

  const preview = (reports || []).slice(0, 4);
  if (!preview.length) {
    return <div style={{ padding: 14, color: 'var(--muted)', fontSize: 13 }}>No flagged items in the moderation queue.</div>;
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface2)' }}>
      {preview.map((r) => {
        const isNew = isNewReport(r.report_id, seenIds);
        return (
        <Link
          key={r.report_id}
          to={`/moderation-queue?status=pending&report_id=${encodeURIComponent(r.report_id)}${
            r.target_type ? `&target_type=${encodeURIComponent(r.target_type)}` : ''
          }`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'background 0.15s',
            background: isNew ? 'rgba(239,68,68,0.06)' : 'transparent',
            borderLeft: isNew ? '3px solid #ef4444' : '3px solid transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isNew ? 'rgba(239,68,68,0.1)' : 'var(--surface)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isNew ? 'rgba(239,68,68,0.06)' : 'transparent';
          }}
        >
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge>{toLabelCase(r.target_type)}</Badge>
              {isNew ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#ef4444',
                  }}
                >
                  New
                </span>
              ) : null}
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>{r.reason || 'Flagged content requires review.'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', alignSelf: 'center' }}>
            Review →
          </div>
        </Link>
        );
      })}
    </div>
  );
}

const CHART_GRID = 'rgba(148,163,184,0.25)';
const CHART_AXIS = 'var(--muted)';
const CHART_GREEN = 'var(--accent)';
const CHART_BLUE = '#60a5fa';

function ChartSkeleton({ height = ANALYTICS_BODY_MIN_HEIGHT }) {
  return (
    <div
      style={{
        ...skeletonStyle,
        height,
        minHeight: height,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'rgba(2,6,23,0.25)',
      }}
    />
  );
}

function RangeToggle({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font)' }}
        >
          <Badge tone={value === opt.key ? 'success' : 'default'}>{opt.label}</Badge>
        </button>
      ))}
    </div>
  );
}

function AnalyticsChartBody({ children, center = false }) {
  return (
    <div
      className="overview-chart-card__body"
      style={center ? { alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 } : undefined}
    >
      {children}
    </div>
  );
}

function RegistrationTrendsChart({ data, loading, trendGroupBy, onTrendGroupByChange }) {
  return (
    <SectionCard
      fill
      title="Parent registration trends"
      subtitle="New registrations"
      right={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <RangeToggle
            value={trendGroupBy}
            onChange={onTrendGroupByChange}
            options={OVERVIEW_TREND_GROUP_OPTIONS}
          />
          <Badge tone="success">{OVERVIEW_GROWTH_RANGE_LABEL}</Badge>
        </div>
      }
    >
      {loading ? (
        <ChartSkeleton />
      ) : !data?.length ? (
        <AnalyticsChartBody center>No registrations in this period.</AnalyticsChartBody>
      ) : (
        <AnalyticsChartBody>
          <ResponsiveContainer width="100%" height={ANALYTICS_BODY_MIN_HEIGHT}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="New parents" fill={CHART_GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartBody>
      )}
    </SectionCard>
  );
}

function AppointmentStatusChart({ data, loading }) {
  return (
    <SectionCard fill title="Appointments by status" subtitle="Current appointment counts by status">
      {loading ? (
        <ChartSkeleton />
      ) : !data?.length ? (
        <AnalyticsChartBody center>No appointments recorded.</AnalyticsChartBody>
      ) : (
        <AnalyticsChartBody>
          <ResponsiveContainer width="100%" height={ANALYTICS_BODY_MIN_HEIGHT}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="Appointments" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartBody>
      )}
    </SectionCard>
  );
}

function FunnelRow({ label, pct, rightLabel, loading, first = false }) {
  return (
    <div className="overview-funnel-row" style={{ marginTop: first ? 0 : 8 }}>
      <div className="overview-funnel-row__label">{label}</div>
      {loading ? (
        <div style={{ ...skeletonStyle, flex: 1, height: 8, borderRadius: 4, background: 'var(--surface2)' }} />
      ) : (
        <div className="overview-funnel-row__track">
          <div className="td-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', borderRadius: 4 }} />
        </div>
      )}
      <div className="overview-funnel-row__value">
        {loading ? '—' : rightLabel}
      </div>
    </div>
  );
}

function ScreeningFunnelCard({ funnel, loading }) {
  const childrenTotal = funnel?.childrenTotal ?? 0;
  const screeningsTotal = funnel?.screeningsTotal ?? 0;
  const ratePct = clampPct(funnel?.ratePct ?? 0);
  const screeningPct =
    childrenTotal > 0 ? clampPct((screeningsTotal / childrenTotal) * 100) : 0;

  return (
    <SectionCard fill title="Screening funnel" subtitle="Children registered vs. screening results completed">
      <div className="overview-funnel-card__body">
        <FunnelRow first label="Children (started)" pct={100} rightLabel={String(childrenTotal)} loading={loading} />
        <FunnelRow label="Screenings completed" pct={screeningPct} rightLabel={String(screeningsTotal)} loading={loading} />
        {!loading ? (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
            {ratePct}% of children have at least one screening result on record
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function TherapistUtilizationCard({ data, loading }) {
  const chartData = (data || []).slice(0, 8).map((t) => mapTherapistBarRow(t, 'sessions'));

  return (
    <SectionCard fill title="Therapist utilization" subtitle="Confirmed + completed appointments per therapist">
      {loading ? (
        <ChartSkeleton height={ANALYTICS_BODY_MIN_HEIGHT} />
      ) : !chartData.length ? (
        <AnalyticsChartBody center>No confirmed or completed sessions yet.</AnalyticsChartBody>
      ) : (
        <AnalyticsChartBody>
          <ResponsiveContainer width="100%" height={ANALYTICS_BODY_MIN_HEIGHT}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fill: CHART_AXIS, fontSize: 11 }} />
              <Tooltip content={<TherapistBarTooltip valueLabel="Sessions" />} />
              <Bar dataKey="sessions" name="Sessions" fill={CHART_GREEN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartBody>
      )}
    </SectionCard>
  );
}

function AssignmentCompletionCard({ data, loading }) {
  const completed = data?.completed ?? 0;
  const total = data?.total ?? 0;
  const ratePct = clampPct(data?.ratePct ?? 0);
  return (
    <SectionCard fill title="Assignment completion" subtitle="Completed vs. total assignments">
      <div className="overview-funnel-card__body">
        <FunnelRow first label="Completed" pct={ratePct} rightLabel={`${completed} / ${total}`} loading={loading} />
        {!loading ? (
          <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--accent)', lineHeight: 1.1 }}>
            {ratePct}%
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function ResourceEngagementCard({ data, loading, trendGroupBy, onTrendGroupByChange }) {
  const trends = data?.trends || [];

  return (
    <SectionCard
      fill
      title="Resource engagement"
      subtitle="Likes and saves on shared community resources"
      right={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <RangeToggle
            value={trendGroupBy}
            onChange={onTrendGroupByChange}
            options={OVERVIEW_TREND_GROUP_OPTIONS}
          />
          <Badge tone="success">{OVERVIEW_GROWTH_RANGE_LABEL}</Badge>
        </div>
      }
    >
      {loading ? (
        <ChartSkeleton />
      ) : !trends.length ? (
        <AnalyticsChartBody center>No likes or saves in this period.</AnalyticsChartBody>
      ) : (
        <AnalyticsChartBody>
          <ResponsiveContainer width="100%" height={ANALYTICS_BODY_MIN_HEIGHT}>
            <LineChart data={trends} margin={{ top: 8, right: 8, left: 0, bottom: 12 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="likes" name="Likes" stroke={CHART_GREEN} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="saves" name="Saves" stroke={CHART_BLUE} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsChartBody>
      )}
    </SectionCard>
  );
}

export default function Overview() {
  const { admin } = useAuth();
  const [trendGroupBy, setTrendGroupBy] = useState('week');
  const {
    stats,
    flaggedReports: reports,
    loading,
    error,
    refetch,
  } = useOverviewStats(OVERVIEW_GROWTH_RANGE, trendGroupBy);

  return (
    <div className="overview-page">
      {error ? <AdminAlert>{error}</AdminAlert> : null}

      <div style={pageHeaderStyle}>
        <div style={{ minWidth: 260 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.4px', margin: 0 }}>
            Hello, {safeFirstName(admin)} 👋
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4, marginBottom: 0 }}>
            Dashboard
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ReportNotificationBell reports={reports} />
          {loading ? <Badge>Refreshing…</Badge> : <Badge tone="success">Live</Badge>}
          <PrimaryButton tone="accent" onClick={refetch} disabled={loading}>
            Refresh
          </PrimaryButton>
        </div>
      </div>

      <div className="overview-analytics-grid">
        <div className="overview-chart-cell" style={{ gridColumn: 'span 12' }}>
          <RegistrationTrendsChart
            data={stats?.registrationTrends}
            loading={loading}
            trendGroupBy={trendGroupBy}
            onTrendGroupByChange={setTrendGroupBy}
          />
        </div>
        <div className="overview-chart-cell" style={{ gridColumn: 'span 12' }}>
          <AppointmentStatusChart data={stats?.appointmentsByStatus} loading={loading} />
        </div>

        <div className="overview-chart-cell" style={{ gridColumn: 'span 12' }}>
          <ResourceEngagementCard
            data={stats?.resourceEngagement}
            loading={loading}
            trendGroupBy={trendGroupBy}
            onTrendGroupByChange={setTrendGroupBy}
          />
        </div>

        <div className="overview-metric-card-cell" style={{ gridColumn: 'span 12' }}>
          <ScreeningFunnelCard funnel={stats?.screeningFunnel} loading={loading} />
        </div>
        <div className="overview-metric-card-cell" style={{ gridColumn: 'span 12' }}>
          <TherapistUtilizationCard data={stats?.therapistUtilization} loading={loading} />
        </div>
        <div className="overview-metric-card-cell" style={{ gridColumn: 'span 12' }}>
          <AssignmentCompletionCard data={stats?.assignmentCompletion} loading={loading} />
        </div>

        <div className="overview-moderation-cell" id="moderation-queue-section">
          <SectionCard
            title="Moderation queue"
            subtitle="Flagged community content awaiting review"
            right={
              <Link
                to="/moderation-queue?status=pending"
                style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
              >
                View all →
              </Link>
            }
          >
            <FlagQueue reports={reports} />
          </SectionCard>
        </div>
      </div>

      <style>{`
        @keyframes overview-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .overview-page {
          padding-bottom: 28px;
        }
        .overview-analytics-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          align-items: stretch;
        }
        .overview-section-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
          flex-shrink: 0;
        }
        .overview-section-card__actions {
          display: flex;
          align-items: center;
        }
        .overview-section-card__body {
          min-height: 0;
        }
        .overview-funnel-card__body {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          min-height: 100%;
        }
        .overview-chart-card__body {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          min-height: 100%;
        }
        .overview-analytics-grid .overview-section-card--fill {
          min-height: ${OVERVIEW_ANALYTICS_CARD_MIN_HEIGHT}px;
          height: 100%;
        }
        @media (min-width: 980px) {
          .overview-analytics-grid {
            grid-auto-rows: minmax(${OVERVIEW_ANALYTICS_CARD_MIN_HEIGHT}px, auto);
          }
        }
        .overview-funnel-row {
          display: grid;
          grid-template-columns: minmax(108px, 34%) minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
        }
        .overview-funnel-row__label {
          font-size: 13px;
          color: var(--muted);
        }
        .overview-funnel-row__track {
          height: 8px;
          border-radius: 4px;
          background: var(--surface2);
          overflow: hidden;
        }
        .overview-funnel-row__value {
          min-width: 52px;
          text-align: right;
          font-size: 12px;
          font-family: var(--mono);
          color: var(--muted);
        }
        .overview-chart-cell,
        .overview-metric-card-cell {
          display: flex;
          flex-direction: column;
          grid-column: span 12;
          min-height: 0;
          min-width: 0;
          align-self: stretch;
        }
        .overview-moderation-cell {
          display: block;
          grid-column: span 12;
          min-height: 0;
        }
        .overview-chart-cell > *,
        .overview-metric-card-cell > * {
          width: 100%;
          min-width: 0;
          flex: 1;
          height: 100%;
        }
        .overview-moderation-cell > * {
          width: 100%;
          min-width: 0;
        }
        .overview-section-card--fill {
          height: 100%;
          flex: 1;
        }
        @media (min-width: 980px) {
          .overview-chart-cell,
          .overview-metric-card-cell {
            grid-column: span 6 !important;
          }
        }
      `}</style>
    </div>
  );
}
