import { Link } from 'react-router-dom';
import { Badge, Btn, formatDate, riskBadgeTone } from './ui/TherapistUI';

export default function PreSessionChildSummary({ bundle, appointmentId, compact = false }) {
  if (!bundle?.child) return null;

  const { child, parent, milestone_summary, latest_screening, reports, is_first_session } = bundle;
  const screeningReports = (reports || []).filter((r) => r.report_type === 'screening_summary');
  const milestoneReports = (reports || []).filter((r) => r.report_type === 'milestone_tracking');

  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: compact ? 12 : 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: compact ? 14 : 16 }}>{child.full_name || 'Child'}</div>
          <div className="td-meta" style={{ marginTop: 4 }}>
            {child.age_label || '—'} · {child.gender || '—'} · DOB {formatDate(child.date_of_birth)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {is_first_session && <Badge tone="warning">First session</Badge>}
          {latest_screening?.risk_level && (
            <Badge tone={riskBadgeTone(latest_screening.risk_level)}>{latest_screening.risk_level}</Badge>
          )}
        </div>
      </div>

      {!compact && (
        <>
          <p style={{ fontSize: 13, margin: '12px 0 6px' }}>
            <strong style={{ color: 'var(--muted)' }}>Parent</strong> · {parent?.full_name || '—'} · {parent?.phone || '—'} · {parent?.email || '—'}
          </p>
          <p style={{ fontSize: 13, margin: '0 0 6px' }}>
            <strong style={{ color: 'var(--muted)' }}>Notes</strong> · {child.notes || '—'}
          </p>
        </>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
        <span>Milestones {milestone_summary?.completed ?? 0}/{milestone_summary?.total ?? 0} ({milestone_summary?.percent ?? 0}%)</span>
        <span>Screening reports {screeningReports.length}</span>
        <span>Milestone reports {milestoneReports.length}</span>
      </div>

      {child.children_id && (
        <div style={{ marginTop: 12 }}>
          <Link
            to={`/therapist/children/${child.children_id}`}
            state={{ appointmentId, preSession: true }}
          >
            <Btn variant="accent">Open full child profile</Btn>
          </Link>
        </div>
      )}
    </div>
  );
}
