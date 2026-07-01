import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useState } from 'react';
import { adminModel } from '../../models/adminModel.js';
import { useAdminListPage } from '../../hooks/useAdminListPage.js';
import { useAdminTable } from '../../hooks/useAdminTable.js';
import {
  AdminPageHeader,
  AdminSelect,
  AdminTable,
  AdminModal,
  adminTdClass,
  adminThClass,
  ConfirmDialog,
  RelativeTime,
} from '../../components/admin/ui';

const AUDIENCE_OPTIONS = [
  { value: 'all_users', label: 'All Users' },
  { value: 'parents_only', label: 'Parents Only' },
  { value: 'therapists_only', label: 'Therapists Only' },
];

const EMPTY_FORM = { title: '', body: '', target_audience: 'all_users' };

export default function AnnouncementsPage() {
  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [audienceFilter, setAudienceFilter] = useState('');

  const { rows, loading, reload, toast } = useAdminListPage(
    () => adminModel.announcements.list(),
    [],
    { errorMessage: 'Failed to load announcements.' },
  );

  const table = useAdminTable(rows, {
    filterFn: audienceFilter ? (row) => row.target_audience === audienceFilter : undefined,
    searchFn: (row, q) =>
      [row.title, row.body, row.target_audience].join(' ').toLowerCase().includes(q),
  });

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and body are required.');
      return;
    }
    setSubmitting(true);
    try {
      await adminModel.announcements.create({
        title: form.title.trim(),
        body: form.body.trim(),
        target_audience: form.target_audience,
      });
      setShowCompose(false);
      setForm({ ...EMPTY_FORM });
      toast.success('Announcement sent.');
      await reload();
    } catch (err) {
      toast.error(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await adminModel.announcements.delete(deleteTarget.announcement_id);
      setDeleteTarget(null);
      toast.success('Announcement deleted.');
      await reload();
    } catch (err) {
      toast.error(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Announcements"
        description={`Broadcast messages to parents and therapists · ${table.total} sent`}
        actions={
          <button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY_FORM });
              setShowCompose(true);
            }}
            className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--text-on-accent)] text-sm font-semibold hover:opacity-90"
          >
            + Compose
          </button>
        }
      />

      <AdminTable
        loading={loading}
        empty={!loading && table.rows.length === 0}
        emptyMessage="No announcements yet."
        emptyHint="Compose one to notify parents or therapists."
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search title or body…"
        page={table.page}
        totalPages={table.totalPages}
        total={table.total}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        onPageChange={table.setPage}
        filters={
          <AdminSelect
            value={audienceFilter}
            onChange={(e) => {
              setAudienceFilter(e.target.value);
              table.setFilterReset();
            }}
            aria-label="Filter by audience"
          >
            <option value="">All audiences</option>
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </AdminSelect>
        }
      >
        <thead>
          <tr>
            <th className={adminThClass}>Title</th>
            <th className={adminThClass}>Audience</th>
            <th className={adminThClass}>Sent</th>
            <th className={adminThClass} />
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.announcement_id}>
              <td className={`${adminTdClass} font-medium max-w-sm`}>{row.title}</td>
              <td className={adminTdClass}>
                <span className="admin-badge">
                  {AUDIENCE_OPTIONS.find((o) => o.value === row.target_audience)?.label ||
                    row.target_audience}
                </span>
              </td>
              <td className={`${adminTdClass} text-[var(--muted)]`}>
                <RelativeTime value={row.sent_at || row.created_at} />
              </td>
              <td className={adminTdClass}>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(row)}
                  className="text-xs text-red-400 border border-red-500/30 rounded-md px-3 py-1 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {showCompose && (
        <AdminModal title="Compose Announcement" onClose={() => !submitting && setShowCompose(false)}>
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <Field label="Title *">
              <input
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="admin-input"
              />
            </Field>
            <Field label="Body *">
              <textarea
                required
                rows={6}
                value={form.body}
                onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                className="admin-input resize-y"
              />
            </Field>
            <Field label="Target audience *">
              <select
                value={form.target_audience}
                onChange={(e) => setForm((p) => ({ ...p, target_audience: e.target.value }))}
                className="admin-input"
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setShowCompose(false)} className="admin-btn-muted flex-1">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="admin-btn-primary flex-1">
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete announcement"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.title}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        submitting={submitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--muted)] block mb-1">{label}</label>
      {children}
    </div>
  );
}
