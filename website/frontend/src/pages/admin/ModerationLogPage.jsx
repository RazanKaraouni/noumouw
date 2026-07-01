import { getUserFacingError } from '../../utils/errorFeedback.js';
import { getErrorMessage } from '../../utils/errorMessages.js';
import { clampDateNotAfterToday, todayDateInputValue } from '../../utils/dateInput.js';
import { useCallback, useEffect, useState } from 'react';
import { adminModel } from '../../models/adminModel.js';
import { useAdminToast } from '../../context/AdminToastContext.jsx';
import { useAdminTable } from '../../hooks/useAdminTable.js';
import {
  AdminPageHeader,
  AdminSelect,
  AdminTable,
  ConfirmDialog,
  adminTdClass,
  adminThClass,
  RelativeTime,
} from '../../components/admin/ui';

export default function ModerationLogPage() {
  const toast = useAdminToast();
  const [rows, setRows] = useState([]);
  const [actionOptions, setActionOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionConfirm, setActionConfirm] = useState(null);
  const [busyLogId, setBusyLogId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 500 };
      if (search.trim()) params.search = search.trim();
      if (action) params.action = action;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data } = await adminModel.logs.moderation(params);
      setRows(data.rows || []);
      if (data.action_options?.length) setActionOptions(data.action_options);
    } catch (err) {
      setRows([]);
      toast.error(getUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }, [search, action, dateFrom, dateTo, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const patchRowLocal = (logId, patch) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.log_id !== logId) return row;
        const next = { ...row, ...patch };
        next.can_suspend = Boolean(next.parent_id || next.therapist_id) && !next.subject_is_suspended;
        next.can_reactivate = Boolean(next.parent_id || next.therapist_id) && Boolean(next.subject_is_suspended);
        return next;
      }),
    );
  };

  const runConfirmedAction = async () => {
    const target = actionConfirm;
    if (!target || busyLogId) return;

    const { type, row } = target;
    const name = row.subject_name || row.subject_email || 'this user';

    try {
      setBusyLogId(row.log_id);

      if (type === 'suspend') {
        if (row.subject_role === 'parent' && row.parent_id) {
          await adminModel.users.suspend(row.parent_id);
        } else if (row.subject_role === 'therapist' && row.therapist_id) {
          await adminModel.therapists.suspend(row.therapist_id);
        } else {
          throw new Error('Cannot suspend this user from the moderation log.');
        }
        patchRowLocal(row.log_id, { subject_is_suspended: true });
        toast.success(`${name} suspended.`);
      } else if (type === 'reactivate') {
        if (row.subject_role === 'parent' && row.parent_id) {
          await adminModel.users.reactivate(row.parent_id);
        } else if (row.subject_role === 'therapist' && row.therapist_id) {
          await adminModel.therapists.reactivate(row.therapist_id);
        } else {
          throw new Error('Cannot reactivate this user from the moderation log.');
        }
        patchRowLocal(row.log_id, { subject_is_suspended: false });
        toast.success(`${name} reactivated.`);
      }

      setActionConfirm(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyLogId(null);
    }
  };

  const table = useAdminTable(rows, {
    searchFn: (row, q) => {
      const blob = [
        row.action_label,
        row.admin_name,
        row.target_label,
        row.subject_name,
        row.subject_email,
        row.subject_role_label,
        row.details,
        row.event_type,
        row.report_id,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    },
  });

  return (
    <div>
      <AdminPageHeader
        title="Moderation Log"
        description="History of moderation actions taken by admins — reports, content removal, warnings, and suspensions."
      />

      <div className="admin-toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search admin, user, target, details…"
          className="admin-toolbar-search"
          aria-label="Server search"
        />
        <div className="admin-toolbar-filters">
          <AdminSelect value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action type">
            <option value="">All actions</option>
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </AdminSelect>
          <input
            type="date"
            value={dateFrom}
            max={todayDateInputValue()}
            onChange={(e) => setDateFrom(clampDateNotAfterToday(e.target.value))}
            className="admin-input"
            style={{ width: 'auto', minWidth: 150 }}
            aria-label="From date"
          />
          <input
            type="date"
            value={dateTo}
            max={todayDateInputValue()}
            onChange={(e) => setDateTo(clampDateNotAfterToday(e.target.value))}
            className="admin-input"
            style={{ width: 'auto', minWidth: 150 }}
            aria-label="To date"
          />
          <button type="button" onClick={load} className="admin-btn-muted">
            Apply filters
          </button>
        </div>
      </div>

      <AdminTable
        loading={loading}
        empty={!loading && table.rows.length === 0}
        emptyMessage="No moderation actions recorded yet."
        emptyHint="Actions from the report queue, community posts, tips, and user management will appear here."
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Filter loaded results…"
        page={table.page}
        totalPages={table.totalPages}
        total={table.total}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        onPageChange={table.setPage}
        skeletonCols={9}
        minWidth="1200px"
        tableLayout="fixed"
      >
        <colgroup>
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={adminThClass}>Date</th>
            <th className={adminThClass}>Admin</th>
            <th className={adminThClass}>Action</th>
            <th className={adminThClass}>Target</th>
            <th className={adminThClass}>User</th>
            <th className={adminThClass}>Role</th>
            <th className={adminThClass}>Email</th>
            <th className={adminThClass}>Details</th>
            <th className={adminThClass}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.log_id}>
              <td className={adminTdClass}>
                <RelativeTime value={row.created_at} />
              </td>
              <td className={adminTdClass}>{row.admin_name || '—'}</td>
              <td className={adminTdClass}>
                <ActionBadge label={row.action_label} />
              </td>
              <td className={`${adminTdClass} admin-table-td--wrap`} title={row.target_label}>
                {row.target_label || '—'}
              </td>
              <td className={adminTdClass}>{row.subject_name || '—'}</td>
              <td className={adminTdClass}>
                {row.subject_role_label ? (
                  <RoleBadge role={row.subject_role_label} />
                ) : (
                  '—'
                )}
              </td>
              <td className={`${adminTdClass} admin-table-td--wrap`}>
                {row.subject_email ? (
                  <span className="font-mono text-xs">{row.subject_email}</span>
                ) : (
                  '—'
                )}
              </td>
              <td className={`${adminTdClass} admin-table-td--wrap text-[var(--muted)]`}>
                {row.details || '—'}
              </td>
              <td className={adminTdClass}>
                <div className="flex flex-wrap gap-1.5">
                  {row.can_reactivate ? (
                    <LogActionBtn
                      label="Reactivate"
                      disabled={busyLogId === row.log_id}
                      onClick={() => setActionConfirm({ type: 'reactivate', row })}
                    />
                  ) : null}
                  {row.can_suspend ? (
                    <LogActionBtn
                      label="Suspend"
                      variant="warn"
                      disabled={busyLogId === row.log_id}
                      onClick={() => setActionConfirm({ type: 'suspend', row })}
                    />
                  ) : null}
                  {!row.can_reactivate && !row.can_suspend ? '—' : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      <ConfirmDialog
        open={Boolean(actionConfirm)}
        title={
          actionConfirm?.type === 'reactivate'
            ? `Reactivate ${actionConfirm?.row?.subject_role_label?.toLowerCase() || 'user'}?`
            : `Suspend ${actionConfirm?.row?.subject_role_label?.toLowerCase() || 'user'}?`
        }
        message={
          actionConfirm?.type === 'reactivate'
            ? `Restore access for "${actionConfirm?.row?.subject_name || actionConfirm?.row?.subject_email}"?`
            : `Suspend "${actionConfirm?.row?.subject_name || actionConfirm?.row?.subject_email}"? They will not be able to sign in.`
        }
        confirmLabel={actionConfirm?.type === 'reactivate' ? 'Reactivate' : 'Suspend'}
        tone={actionConfirm?.type === 'reactivate' ? 'accent' : 'warn'}
        submitting={Boolean(busyLogId)}
        onCancel={() => !busyLogId && setActionConfirm(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}

function LogActionBtn({ label, onClick, disabled, variant }) {
  const colors =
    variant === 'warn'
      ? { border: 'rgba(251,191,36,0.45)', color: '#fbbf24' }
      : { border: 'rgba(var(--green-rgb),0.35)', color: 'var(--accent)' };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 10px',
        borderRadius: 6,
        border: `1px solid ${colors.border}`,
        background: 'transparent',
        color: colors.color,
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'var(--font)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function ActionBadge({ label }) {
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/15 text-violet-300">
      {label || '—'}
    </span>
  );
}

function RoleBadge({ role }) {
  const isTherapist = role === 'Therapist';
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{
        background: isTherapist ? 'rgba(168,85,247,0.15)' : 'rgba(var(--green-rgb),0.12)',
        color: isTherapist ? '#c084fc' : 'var(--accent)',
      }}
    >
      {role}
    </span>
  );
}
