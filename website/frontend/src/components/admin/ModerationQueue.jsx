import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminModel } from '../../models/adminModel.js';
import { useAdminToast } from '../../context/AdminToastContext.jsx';
import { useAdminTable } from '../../hooks/useAdminTable.js';
import {
  AdminPageHeader,
  AdminTable,
  AdminSelect,
  adminTdClass,
  adminThClass,
  ConfirmDialog,
  AdminModal,
  DialogButton,
  DialogFooter,
  RelativeTime,
} from './ui';

const TARGET_COLORS = {
  resource: { bg: 'rgba(var(--green-rgb),0.12)', color: 'var(--accent)', label: 'Resource' },
  post: { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', label: 'Post' },
  comment: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', label: 'Comment' },
  tip: { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', label: 'Tip' },
};

const RESOLVED_STATUSES = new Set(['resolved', 'content_removed', 'user_suspended']);

function targetTagClass(type) {
  const key = (type || '').toLowerCase();
  const palette = TARGET_COLORS[key] || TARGET_COLORS.resource;
  return { background: palette.bg, color: palette.color, label: palette.label };
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  const resolved = RESOLVED_STATUSES.has(s);
  const style = resolved
    ? { bg: 'rgba(var(--green-rgb),0.15)', color: 'var(--green)', label: 'Resolved' }
    : s === 'dismissed'
      ? { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: 'Dismissed' }
      : { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Pending' };
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function authorActionEnabled(report) {
  return Boolean(report?.target_user_id || report?.target_therapist_id);
}

function authorLabel(report) {
  const name = (report?.target_author_name || '').trim();
  const role = (report?.target_author_role || '').trim();
  if (name && role) return `${name} (${role})`;
  if (name) return name;
  if (role) return role;
  return 'content author';
}

const DESTRUCTIVE_ACTIONS = {
  remove_content: {
    title: 'Remove content',
    message: 'This will delete the reported content permanently. Continue?',
    confirmLabel: 'Remove content',
  },
  remove_tip: {
    title: 'Delete tip',
    message: 'This will permanently delete the reported parenting tip from the app. Continue?',
    confirmLabel: 'Delete tip',
  },
  suspend_user: {
    title: 'Suspend author',
    message: (report) =>
      `Suspend ${authorLabel(report)}? They will not be able to sign in.`,
    confirmLabel: 'Suspend author',
  },
  dismissed: {
    title: 'Dismiss report',
    message: 'Mark this report as dismissed with no further action?',
    confirmLabel: 'Dismiss',
    danger: false,
  },
  reject_report: {
    title: 'Reject report',
    message: 'Reject this report and keep the tip published in the app?',
    confirmLabel: 'Reject report',
    danger: false,
  },
};

export default function ModerationQueue() {
  const toast = useAdminToast();
  const [searchParams] = useSearchParams();
  const highlightReportId = searchParams.get('report_id') || '';
  const initialFiltersApplied = useRef(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [targetFilter, setTargetFilter] = useState('');
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnNote, setWarnNote] = useState('');
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (initialFiltersApplied.current) return;
    const status = searchParams.get('status');
    const targetType = searchParams.get('target_type');
    if (status) setStatusFilter(status);
    if (targetType) setTargetFilter(targetType);
    initialFiltersApplied.current = true;
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: statusFilter };
      if (targetFilter) params.target_type = targetFilter;
      const { data } = await adminModel.reports.list(params);
      setReports(data || []);
    } catch (err) {
      setReports([]);
      toast.error(getUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, targetFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!highlightReportId || loading) return;
    const el = document.getElementById(`report-${highlightReportId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightReportId, loading, reports]);

  const filterFn = useCallback(() => true, []);

  const table = useAdminTable(reports, {
    filterFn,
    searchFn: (row, q) => {
      const r = row;
      const blob = [
        r.reporter_name,
        r.reporter_email,
        r.reason,
        r.content_preview,
        r.target_type,
        r.status,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    },
  });

  const runAction = async (reportId, action, extra = {}) => {
    setBusyId(reportId);
    try {
      await adminModel.reports.resolve(reportId, { action, ...extra });
      setReports((rows) => rows.filter((r) => r.report_id !== reportId));
      setWarnTarget(null);
      setWarnNote('');
      setConfirm(null);
      toast.success('Report updated.');
    } catch (err) {
      toast.error(getUserFacingError(err));
    } finally {
      setBusyId(null);
    }
  };

  const requestConfirm = (report, action) => {
    const isTip = (report?.target_type || '').toLowerCase() === 'tip';
    const metaKey =
      action === 'remove_content' && isTip
        ? 'remove_tip'
        : action === 'dismissed' && isTip
          ? 'reject_report'
          : action;
    const meta = DESTRUCTIVE_ACTIONS[metaKey];
    if (!meta) return;
    const message = typeof meta.message === 'function' ? meta.message(report) : meta.message;
    setConfirm({ report, action, ...meta, message, danger: meta.danger !== false });
  };

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <AdminPageHeader
        title="Report Queue"
        description={`Review flagged content awaiting moderation${
          statusFilter === 'pending' && !loading ? ` · ${pendingCount} pending` : ''
        }`}
      />

      <AdminTable
        loading={loading}
        empty={!loading && table.rows.length === 0}
        emptyMessage="No reports match these filters."
        emptyHint="Try changing status or target type, or clear your search."
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search reporter, reason, preview…"
        page={table.page}
        totalPages={table.totalPages}
        total={table.total}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        onPageChange={table.setPage}
        filters={
          <>
            <AdminSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                table.setFilterReset();
              }}
              aria-label="Filter by status"
            >
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </AdminSelect>
            <AdminSelect
              value={targetFilter}
              onChange={(e) => {
                setTargetFilter(e.target.value);
                table.setFilterReset();
              }}
              aria-label="Filter by target type"
            >
              <option value="">All types</option>
              <option value="resource">Resource</option>
              <option value="post">Post</option>
              <option value="comment">Comment</option>
              <option value="tip">Tip</option>
            </AdminSelect>
          </>
        }
        skeletonCols={8}
        minWidth="900px"
      >
        <thead>
          <tr>
            <th className={adminThClass}>Reporter</th>
            <th className={adminThClass}>Target</th>
            <th className={adminThClass}>Author</th>
            <th className={adminThClass}>Reason</th>
            <th className={adminThClass}>Preview</th>
            <th className={adminThClass}>Status</th>
            <th className={adminThClass}>Date</th>
            <th className={adminThClass}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((report) => {
            const busy = busyId === report.report_id;
            const isPending = report.status === 'pending';
            const tag = targetTagClass(report.target_type);
            const isTip = (report.target_type || '').toLowerCase() === 'tip';
            const isHighlighted =
              highlightReportId && String(report.report_id) === String(highlightReportId);
            return (
              <tr
                key={report.report_id}
                id={isHighlighted ? `report-${report.report_id}` : undefined}
                className="hover:bg-[var(--surface2)]/50"
                style={
                  isHighlighted
                    ? { background: 'rgba(var(--green-rgb), 0.1)', outline: '2px solid var(--accent)' }
                    : undefined
                }
              >
                <td className={adminTdClass}>
                  <div className="font-medium">{report.reporter_name || '—'}</div>
                  {report.reporter_email && (
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">{report.reporter_email}</div>
                  )}
                </td>
                <td className={adminTdClass}>
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: tag.background, color: tag.color }}
                  >
                    {tag.label}
                  </span>
                </td>
                <td className={adminTdClass}>
                  <div className="font-medium">{report.target_author_name || '—'}</div>
                  {report.target_author_role && (
                    <div className="text-[11px] text-[var(--muted)] mt-0.5 capitalize">
                      {report.target_author_role}
                      {report.target_author_email ? ` · ${report.target_author_email}` : ''}
                    </div>
                  )}
                </td>
                <td className={`${adminTdClass} max-w-[200px] leading-relaxed`}>{report.reason}</td>
                <td className={`${adminTdClass} max-w-[260px] text-[var(--muted)] leading-relaxed`}>
                  {report.content_preview || '—'}
                </td>
                <td className={adminTdClass}>
                  <StatusBadge status={report.status} />
                </td>
                <td className={`${adminTdClass} text-[var(--muted)] whitespace-nowrap`}>
                  <RelativeTime value={report.created_at} />
                </td>
                <td className={adminTdClass}>
                  {isPending ? (
                    <div className="flex flex-wrap gap-1.5">
                      <ActionBtn disabled={busy} onClick={() => requestConfirm(report, 'dismissed')}>
                        {isTip ? 'Reject report' : 'Dismiss'}
                      </ActionBtn>
                      <ActionBtn
                        disabled={busy}
                        danger
                        onClick={() => requestConfirm(report, 'remove_content')}
                      >
                        {isTip ? 'Delete tip' : 'Remove'}
                      </ActionBtn>
                      <ActionBtn
                        disabled={busy || !authorActionEnabled(report)}
                        warn
                        onClick={() => {
                          setWarnNote(report.reason || '');
                          setWarnTarget(report);
                        }}
                      >
                        Warn
                      </ActionBtn>
                      <ActionBtn
                        disabled={busy || !authorActionEnabled(report)}
                        warn
                        onClick={() => requestConfirm(report, 'suspend_user')}
                      >
                        Suspend
                      </ActionBtn>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </AdminTable>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        submitting={busyId === confirm?.report?.report_id}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm && runAction(confirm.report.report_id, confirm.action)
        }
      />

      {warnTarget && (
        <AdminModal
          title={`Warn ${authorLabel(warnTarget)}`}
          onClose={() => {
            setWarnTarget(null);
            setWarnNote('');
          }}
        >
          <p className="confirm-dialog-message" style={{ marginTop: 0 }}>
            Send a moderation warning to the person who posted this{' '}
            {(warnTarget?.target_type || 'content').replace(/_/g, ' ')}. The report will be
            marked resolved.
          </p>
          <textarea
            value={warnNote}
            onChange={(e) => setWarnNote(e.target.value)}
            rows={4}
            className="admin-input"
            style={{ marginTop: 12, resize: 'vertical' }}
          />
          <DialogFooter>
            <DialogButton
              onClick={() => {
                setWarnTarget(null);
                setWarnNote('');
              }}
            >
              Cancel
            </DialogButton>
            <DialogButton
              variant="warning"
              disabled={busyId === warnTarget.report_id || !warnNote.trim()}
              onClick={() =>
                runAction(warnTarget.report_id, 'warn_user', { reason: warnNote.trim() })
              }
            >
              Send warning
            </DialogButton>
          </DialogFooter>
        </AdminModal>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, danger, warn }) {
  let cls =
    'px-2 py-1 rounded-md border text-[11px] font-semibold disabled:opacity-40 border-[var(--border)] bg-[var(--surface2)]';
  if (danger) cls += ' border-red-500/40 text-red-400';
  else if (warn) cls += ' border-amber-500/40 text-amber-300';
  else cls += ' text-[var(--muted)]';
  return (
    <button type="button" className={cls} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
