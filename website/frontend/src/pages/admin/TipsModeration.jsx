import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/axios.js';
import { useAdminToast } from '../../context/AdminToastContext.jsx';
import {
  AdminPageHeader,
  AdminTable,
  AdminSelect,
  adminTdClass,
  adminThClass,
  RelativeTime,
} from '../../components/admin/ui';
import ConfirmDeleteModal from '../../components/admin/tips/ConfirmDeleteModal.jsx';
import {
  PARENTING_HUB_CATEGORIES,
  tipCategoryLabel,
} from '../../constants/parentingHubCategories.js';

const CATEGORY_STYLES = {
  general: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  emotional_regulation: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  communication: { bg: 'rgba(var(--green-rgb),0.15)', color: 'var(--green)' },
  routines: { bg: 'rgba(251,146,60,0.15)', color: '#fb923c' },
};

function CategoryPill({ category }) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.general;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {tipCategoryLabel(category)}
    </span>
  );
}

function RoleBadge({ role }) {
  const isTherapist = role === 'therapist';
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize"
      style={{
        background: isTherapist ? 'rgba(168,85,247,0.15)' : 'rgba(148,163,184,0.15)',
        color: isTherapist ? '#c084fc' : '#94a3b8',
      }}
    >
      {role || '—'}
    </span>
  );
}

function tipId(tip) {
  return tip?.tip_id ?? tip?.id;
}

export default function TipsModeration() {
  const toast = useAdminToast();
  const [allTips, setAllTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const loadAllTips = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tips');
      setAllTips(Array.isArray(data) ? data : []);
    } catch (err) {
      setAllTips([]);
      toast.error(getUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAllTips();
  }, [loadAllTips]);

  const handleDeleteConfirm = async () => {
    setDeleteTarget(null);
    await loadAllTips();
    toast.success('Tip deleted.');
  };

  const filteredTips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTips.filter((tip) => {
      if (q) {
        const haystack = `${tip.title || ''} ${tip.content || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (categoryFilter && tip.category !== categoryFilter) return false;
      return true;
    });
  }, [allTips, search, categoryFilter]);

  return (
    <div>
      <AdminPageHeader
        title="Tips"
        description={`Therapist tips published in the parent app · ${allTips.length} total · delete to remove from the hub`}
      />

      <AdminTable
        loading={loading}
        empty={!loading && filteredTips.length === 0}
        emptyMessage="No tips yet."
        emptyHint="Therapists add tips from the therapist portal."
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title or content…"
        showPagination={false}
        tableLayout="fixed"
        minWidth="1040px"
        filters={
          <AdminSelect
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {PARENTING_HUB_CATEGORIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </AdminSelect>
        }
      >
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={adminThClass}>Title</th>
            <th className={adminThClass}>Tip content</th>
            <th className={adminThClass}>Submitter</th>
            <th className={adminThClass}>Role</th>
            <th className={adminThClass}>Category</th>
            <th className={adminThClass}>Submitted At</th>
            <th className={`${adminThClass} admin-table-th--actions`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredTips.map((tip) => (
            <tr key={tipId(tip)}>
              <td className={adminTdClass}>
                <span className="font-medium">{tip.title}</span>
              </td>
              <td className={`${adminTdClass} admin-table-td--wrap`}>
                <p className="text-sm text-[var(--muted)] whitespace-pre-wrap line-clamp-4 m-0 break-words">
                  {tip.content || '—'}
                </p>
              </td>
              <td className={adminTdClass}>{tip.submitter_name || 'Unknown'}</td>
              <td className={adminTdClass}>
                <RoleBadge role={tip.submitted_by_role} />
              </td>
              <td className={adminTdClass}>
                <CategoryPill category={tip.category} />
              </td>
              <td className={adminTdClass}>
                <RelativeTime value={tip.created_at} />
              </td>
              <td className={`${adminTdClass} admin-table-td--actions`}>
                <button
                  type="button"
                  className="admin-btn-danger-sm"
                  onClick={() => setDeleteTarget(tip)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {deleteTarget && (
        <ConfirmDeleteModal
          tip={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
