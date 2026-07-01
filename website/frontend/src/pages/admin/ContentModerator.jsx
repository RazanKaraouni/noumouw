import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useState } from 'react';
import api from '../../services/axios';
import { adminModel } from '../../models/adminModel.js';
import { useAdminToast } from '../../context/AdminToastContext.jsx';
import { useAdminListPage } from '../../hooks/useAdminListPage.js';
import { useAdminTable } from '../../hooks/useAdminTable.js';
import {
  AdminPageHeader,
  AdminSelect,
  AdminTable,
  adminTdClass,
  adminThClass,
  ConfirmDialog,
  RelativeTime,
} from '../../components/admin/ui';

function contentTypeLabel(type) {
  const t = (type || '').toLowerCase();
  if (t === 'video') return 'Video';
  if (t === 'image') return 'Image';
  if (t === 'article') return 'Article';
  return type || '—';
}

function formatAgeRange(value) {
  if (!value) return '—';
  const v = String(value).trim();
  if (v.toLowerCase() === 'all') return 'All';
  return v;
}

function PublicToggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? 'Public' : 'Private'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: disabled ? 'wait' : 'pointer',
        background: checked ? 'var(--accent)' : 'var(--surface2)',
        boxShadow: checked
          ? 'inset 0 0 0 1px rgba(var(--green-rgb),0.4)'
          : 'inset 0 0 0 1px var(--border)',
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: checked ? 'var(--text-on-accent)' : 'var(--muted)',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}

export default function ResourcesBoard() {
  const toast = useAdminToast();
  const [resources, setResources] = useState([]);
  const [publicFilter, setPublicFilter] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { loading, reload } = useAdminListPage(
    async () => {
      const { data } = await adminModel.resources.listForModeration();
      setResources(data || []);
      return { data };
    },
    [],
    { errorMessage: 'Could not load resources.' },
  );

  const table = useAdminTable(resources, {
    filterFn: publicFilter === 'public'
      ? (r) => r.is_public
      : publicFilter === 'private'
        ? (r) => !r.is_public
        : undefined,
    searchFn: (r, q) =>
      `${r.title ?? ''} ${r.therapist_name ?? ''} ${r.publisher ?? ''} ${r.content_type ?? ''} ${r.domain ?? ''} ${r.age_range ?? ''}`
        .toLowerCase()
        .includes(q),
  });

  const handleTogglePublic = async (resource, nextPublic) => {
    const id = resource.resources_id;
    setTogglingId(id);
    try {
      const { data } = await api.patch(`/admin/resources/${id}/public`, {
        is_public: nextPublic,
      });
      setResources((rows) =>
        rows.map((r) => (r.resources_id === id ? { ...r, ...data } : r)),
      );
      toast.success(nextPublic ? 'Resource is now public.' : 'Resource is now private.');
    } catch (err) {
      toast.error(getUserFacingError(err));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/resources/${deleteTarget.resources_id}`);
      setResources((rows) =>
        rows.filter((r) => r.resources_id !== deleteTarget.resources_id),
      );
      setDeleteTarget(null);
      toast.success('Resource deleted.');
      await reload();
    } catch (err) {
      toast.error(getUserFacingError(err));
    } finally {
      setDeleting(false);
    }
  };

  const publicCount = resources.filter((r) => r.is_public).length;

  return (
    <div>
      <AdminPageHeader
        title="Resources Board"
        description={
          loading
            ? 'Loading…'
            : `${resources.length} resources · ${publicCount} public in Learn`
        }
      />

      <AdminTable
        loading={loading}
        empty={!loading && table.filtered.length === 0}
        emptyMessage="No resources match your search or filters."
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search title, therapist, domain…"
        showPagination={false}
        filters={
          <AdminSelect
            value={publicFilter}
            onChange={(e) => {
              setPublicFilter(e.target.value);
              table.setFilterReset();
            }}
            aria-label="Filter by visibility"
          >
            <option value="">All visibility</option>
            <option value="public">Public only</option>
            <option value="private">Private only</option>
          </AdminSelect>
        }
        skeletonCols={10}
        minWidth="1080px"
      >
        <thead>
          <tr>
            {['Title', 'Type', 'Therapist', 'Domain', 'Age', 'Likes', 'Saves', 'Public', 'Date', ''].map(
              (h) => (
                <th key={h || 'actions'} className={adminThClass}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {table.filtered.map((r) => (
                <tr key={r.resources_id}>
                  <td className={`${adminTdClass} font-medium max-w-[220px]`}>
                    {r.title || '—'}
                  </td>
                  <td className={adminTdClass}>
                    <span className="admin-badge">
                      {contentTypeLabel(r.content_type)}
                    </span>
                  </td>
                  <td className={adminTdClass}>{r.therapist_name || '—'}</td>
                  <td className={adminTdClass} style={{ textTransform: 'capitalize' }}>
                    {r.domain || '—'}
                  </td>
                  <td className={adminTdClass}>{formatAgeRange(r.age_range)}</td>
                  <td className={adminTdClass} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {r.likes_count ?? 0}
                  </td>
                  <td className={adminTdClass} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {r.saves_count ?? 0}
                  </td>
                  <td className={adminTdClass}>
                    <PublicToggle
                      checked={Boolean(r.is_public)}
                      disabled={togglingId === r.resources_id}
                      onChange={(next) => handleTogglePublic(r, next)}
                    />
                  </td>
                  <td className={adminTdClass} style={{ color: 'var(--muted)' }}>
                    <RelativeTime value={r.created_at} />
                  </td>
                  <td className={adminTdClass}>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="admin-btn-danger-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
        </tbody>
      </AdminTable>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete resource"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.title || 'Untitled'}" by ${deleteTarget.therapist_name || 'this therapist'}? Likes and saves will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        submitting={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
