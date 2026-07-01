import { getUserFacingError } from '../utils/errorFeedback.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/axios.js';
import TipFormModal from '../components/tips/TipFormModal.jsx';
import ConfirmDeleteModal from '../components/tips/ConfirmDeleteModal.jsx';
import {
  PageHeader,
  GlassCard,
  Btn,
  Badge,
  Skeleton,
  EmptyState,
  formatDate,
} from '../components/therapist/ui/TherapistUI.jsx';
import {
  LEGACY_TIP_CATEGORY_LABELS,
  PARENTING_HUB_CATEGORIES,
  tipCategoryLabel,
} from '../constants/parentingHubCategories.js';
import { ageRangeFromTip, formatTipAgeRange, TIP_AGE_RANGE_OPTIONS } from '../utils/tipAgeRange.js';

const CATEGORY_FILTER_OPTIONS = [
  ...PARENTING_HUB_CATEGORIES,
  ...Object.entries(LEGACY_TIP_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

const CATEGORY_TONES = {
  general: { bg: 'rgba(100, 116, 139, 0.18)', color: '#94a3b8' },
  emotional_regulation: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  communication: { bg: 'rgba(var(--green-rgb), 0.15)', color: 'var(--green)' },
  routines: { bg: 'rgba(251, 146, 60, 0.15)', color: '#fb923c' },
};

const STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--muted)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border)',
};

function CategoryPill({ category }) {
  const tone = CATEGORY_TONES[category] || CATEGORY_TONES.general;
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: tone.bg,
        color: tone.color,
        whiteSpace: 'nowrap',
      }}
    >
      {tipCategoryLabel(category)}
    </span>
  );
}

function StatusBadge({ status, rejectionReason }) {
  const tone = STATUS_TONE[status] || 'default';
  const badge = <Badge tone={tone}>{status}</Badge>;

  if (status === 'rejected' && rejectionReason) {
    return (
      <span title={rejectionReason} style={{ cursor: 'help' }}>
        {badge}
      </span>
    );
  }

  return badge;
}

export default function MyTips() {
  const { therapist } = useAuth();
  const therapistId = therapist?.therapist_id;

  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formTip, setFormTip] = useState(undefined);
  const [deleteTip, setDeleteTip] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ageRangeFilter, setAgeRangeFilter] = useState('');

  const loadTips = useCallback(async () => {
    if (!therapistId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get(`/tips/therapist/${therapistId}`);
      setTips(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getUserFacingError(err));
      setTips([]);
    } finally {
      setLoading(false);
    }
  }, [therapistId]);

  useEffect(() => {
    loadTips();
  }, [loadTips]);

  const handleFormSuccess = () => {
    setFormTip(undefined);
    loadTips();
  };

  const handleDeleteSuccess = () => {
    setDeleteTip(null);
    loadTips();
  };

  const filteredTips = useMemo(() => {
    return tips.filter((tip) => {
      if (categoryFilter && tip.category !== categoryFilter) return false;
      if (ageRangeFilter && ageRangeFromTip(tip) !== ageRangeFilter) return false;
      return true;
    });
  }, [tips, categoryFilter, ageRangeFilter]);

  const hasActiveFilters = Boolean(categoryFilter || ageRangeFilter);

  const editBtnStyle = {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '3px 8px',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'var(--font)',
  };

  const deleteBtnStyle = {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '3px 8px',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'var(--font)',
  };

  return (
    <div className="td-fade-in">
      <PageHeader
        title="Parenting Tips"
        subtitle="Share knowledge with families"
        action={
          <Btn variant="primary" onClick={() => setFormTip(null)}>
            Add New Tip
          </Btn>
        }
      />

      {error && <div className="td-alert td-alert-error">{error}</div>}

      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton style={{ height: 36 }} />
            <Skeleton style={{ height: 36 }} />
            <Skeleton style={{ height: 36 }} />
          </div>
        )}

        {!loading && tips.length === 0 && (
          <EmptyState
            icon="💡"
            title="No tips yet"
            description="Share your first parenting tip with families. Published tips appear immediately in the parent app."
            action={
              <Btn variant="primary" style={{ marginTop: 16 }} onClick={() => setFormTip(null)}>
                Add New Tip
              </Btn>
            }
          />
        )}

        {!loading && tips.length > 0 && filteredTips.length === 0 && (
          <EmptyState
            icon="🔍"
            title="No tips match these filters"
            description="Try a different category or age range, or clear the filters to see all tips."
            action={
              hasActiveFilters ? (
                <Btn
                  variant="ghost"
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setCategoryFilter('');
                    setAgeRangeFilter('');
                  }}
                >
                  Clear filters
                </Btn>
              ) : null
            }
          />
        )}

        {!loading && filteredTips.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'flex-end',
                padding: '16px 16px 0',
              }}
            >
              <div className="td-field" style={{ marginBottom: 0, minWidth: 200, flex: '1 1 180px' }}>
                <label className="td-label" htmlFor="tips-category-filter">
                  Category
                </label>
                <select
                  id="tips-category-filter"
                  className="td-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All categories</option>
                  {CATEGORY_FILTER_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="td-field" style={{ marginBottom: 0, minWidth: 200, flex: '1 1 180px' }}>
                <label className="td-label" htmlFor="tips-age-range-filter">
                  Age range
                </label>
                <select
                  id="tips-age-range-filter"
                  className="td-select"
                  value={ageRangeFilter}
                  onChange={(e) => setAgeRangeFilter(e.target.value)}
                >
                  <option value="">All age ranges</option>
                  {TIP_AGE_RANGE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {hasActiveFilters && (
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setCategoryFilter('');
                    setAgeRangeFilter('');
                  }}
                >
                  Clear filters
                </Btn>
              )}
            </div>
            <div style={{ overflowX: 'auto', padding: '12px 0 0' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Age range</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Submitted</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTips.map((tip) => (
                  <tr key={tip.tip_id ?? tip.id}>
                    <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 280 }}>
                      {tip.title}
                    </td>
                    <td style={tdStyle}>
                      <CategoryPill category={tip.category} />
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }} className="td-meta">
                      {formatTipAgeRange(tip)}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge
                        status={tip.status}
                        rejectionReason={tip.rejection_reason}
                      />
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }} className="td-meta">
                      {formatDate(tip.created_at)}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {['pending', 'approved'].includes(tip.status) && (
                          <button
                            type="button"
                            style={editBtnStyle}
                            onClick={() => setFormTip(tip)}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          style={deleteBtnStyle}
                          onClick={() => setDeleteTip(tip)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--danger)';
                            e.currentTarget.style.color = 'var(--danger)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--muted)';
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </GlassCard>

      {formTip !== undefined && (
        <TipFormModal
          tip={formTip || undefined}
          onClose={() => setFormTip(undefined)}
          onSuccess={handleFormSuccess}
        />
      )}

      {deleteTip && (
        <ConfirmDeleteModal
          tip={deleteTip}
          onClose={() => setDeleteTip(null)}
          onConfirm={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
