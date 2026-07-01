import { RelativeTime, AdminModal } from '../ui';
import { formatTipAgeRange } from '../../../utils/tipAgeRange.js';
import { tipCategoryLabel } from '../../../constants/parentingHubCategories.js';

const CATEGORY_STYLES = {
  general: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  emotional_regulation: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  communication: { bg: 'rgba(var(--green-rgb),0.15)', color: 'var(--green)' },
  routines: { bg: 'rgba(251,146,60,0.15)', color: '#fb923c' },
};

const STATUS_STYLES = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  approved: { bg: 'rgba(var(--green-rgb),0.15)', color: 'var(--green)' },
  rejected: { bg: 'rgba(239,68,68,0.16)', color: '#ef4444' },
};

function Pill({ label, style }) {
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize"
      style={{ background: style.bg, color: style.color }}
    >
      {label}
    </span>
  );
}

function RoleBadge({ role }) {
  const isParent = role === 'parent';
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize"
      style={{
        background: isParent ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
        color: isParent ? '#60a5fa' : '#c084fc',
      }}
    >
      {role || '—'}
    </span>
  );
}

export default function TipDetailModal({ tip, onClose }) {
  if (!tip) return null;

  const categoryStyle = CATEGORY_STYLES[tip.category] || CATEGORY_STYLES.general;
  const statusStyle = STATUS_STYLES[tip.status] || STATUS_STYLES.pending;

  return (
    <AdminModal title={tip.title} size="lg" onClose={onClose} titleId="tip-detail-title">
      <div className="flex flex-wrap gap-2 mb-4">
        <RoleBadge role={tip.submitted_by_role} />
        <Pill label={tipCategoryLabel(tip.category)} style={categoryStyle} />
        <Pill label={tip.status} style={statusStyle} />
      </div>

      <p className="text-sm text-[var(--muted)] mb-4">
        Submitted by <strong className="text-[var(--text)]">{tip.submitter_name || 'Unknown'}</strong>
        {' · '}
        <RelativeTime value={tip.created_at} />
        {' · '}
        Ages: <strong className="text-[var(--text)]">{formatTipAgeRange(tip)}</strong>
      </p>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-4 text-sm leading-relaxed text-[var(--text)] max-h-[40vh] overflow-y-auto whitespace-pre-wrap">
        {tip.content}
      </div>

      {tip.status === 'rejected' && tip.rejection_reason && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-300 mb-1">
            Rejection reason
          </p>
          <p className="text-sm text-red-100 whitespace-pre-wrap">{tip.rejection_reason}</p>
        </div>
      )}
    </AdminModal>
  );
}
