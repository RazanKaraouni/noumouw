import { Fragment, useCallback, useEffect, useState } from 'react';
import { adminModel } from '../../models/adminModel.js';
import { useAdminToast } from '../../context/AdminToastContext.jsx';
import { useAdminTable } from '../../hooks/useAdminTable.js';
import { getErrorMessage } from '../../utils/errorMessages.js';
import {
  ConfirmDialog,
  RelativeTime,
  TableSkeleton,
} from '../../components/admin/ui';

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font)',
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

const th = {
  padding: '12px 14px',
  textAlign: 'left',
  color: 'var(--muted)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
};

const td = { padding: '12px 14px', fontSize: 13, verticalAlign: 'middle' };

function formatDate(raw) {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function StatusBadge({ parent }) {
  if (parent.is_suspended) {
    return (
      <span
        style={{
          background: 'rgba(239,68,68,0.12)',
          color: 'var(--danger)',
          padding: '3px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        Suspended
      </span>
    );
  }
  if (parent.is_verified) {
    return (
      <span
        style={{
          background: 'rgba(var(--green-rgb),0.12)',
          color: 'var(--accent)',
          padding: '3px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        Verified
      </span>
    );
  }
  return (
    <span
      style={{
        background: 'rgba(251,191,36,0.12)',
        color: '#fbbf24',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      Unverified
    </span>
  );
}

function ActionButton({ children, onClick, disabled, tone = 'default' }) {
  const styles = {
    default: {
      border: '1px solid var(--border)',
      background: 'var(--surface2)',
      color: 'var(--text)',
    },
    accent: {
      border: '1px solid rgba(var(--green-rgb),0.35)',
      background: 'rgba(var(--green-rgb),0.08)',
      color: 'var(--accent)',
    },
    warn: {
      border: '1px solid rgba(251,191,36,0.35)',
      background: 'rgba(251,191,36,0.08)',
      color: '#fbbf24',
    },
    danger: {
      border: '1px solid #FCA5A5',
      background: 'rgba(239,68,68,0.08)',
      color: '#DC2626',
    },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[tone],
        borderRadius: 8,
        padding: '5px 9px',
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'var(--font)',
      }}
    >
      {children}
    </button>
  );
}

function parentRowKey(parent) {
  return parent.parent_id || parent.user_id;
}

function ParentChildrenDrawer({ parent, cache, onClose }) {
  const { items = [], loading = false, error = '' } = cache || {};

  return (
    <div
      style={{
        padding: '14px 16px 16px',
        background: 'var(--surface2)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Children for {parent.full_name || 'Parent'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {parent.email || '—'} · {parent.children_count ?? items.length} registered
          </div>
        </div>
        <ActionButton onClick={onClose}>Close</ActionButton>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Loading children…</p>
      ) : error ? (
        <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No children linked to this parent.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Full Name', 'Date of Birth', 'Gender', 'Notes', 'Registered'].map((h) => (
                  <th key={h} style={{ ...th, padding: '8px 10px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((child) => (
                <tr key={child.children_id ?? child.child_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...td, padding: '10px', fontWeight: 600 }}>{child.full_name || '—'}</td>
                  <td style={{ ...td, padding: '10px', color: 'var(--muted)' }}>
                    {formatDate(child.date_of_birth)}
                  </td>
                  <td style={{ ...td, padding: '10px', color: 'var(--muted)' }}>{child.gender ?? '—'}</td>
                  <td style={{ ...td, padding: '10px', color: 'var(--muted)' }} title={child.notes || ''}>
                    {child.notes ? (child.notes.length > 40 ? `${child.notes.slice(0, 40)}…` : child.notes) : '—'}
                  </td>
                  <td style={{ ...td, padding: '10px', color: 'var(--muted)' }}>
                    {formatDate(child.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const toast = useAdminToast();
  const [parents, setParents] = useState([]);
  const [suspendedFilter, setSuspendedFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyParentId, setBusyParentId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [expandedParentId, setExpandedParentId] = useState(null);
  const [childrenCache, setChildrenCache] = useState({});

  const loadParents = useCallback(
    () =>
      adminModel.users
        .listParents()
        .then((r) => setParents(r.data || []))
        .catch((e) => {
          console.error(e);
          toast.error(getErrorMessage(e));
        }),
    [toast],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadParents();
      setLoading(false);
    })();
  }, [loadParents]);

  const fetchChildrenForParent = useCallback(
    async (parent) => {
      const key = parentRowKey(parent);
      if (!key) return;

      setChildrenCache((prev) => ({
        ...prev,
        [key]: { ...prev[key], loading: true, error: '' },
      }));

      try {
        const identifier = parent.parent_id || parent.user_id;
        const { data } = await adminModel.users.listParentChildren(identifier);
        setChildrenCache((prev) => ({
          ...prev,
          [key]: { items: data || [], loading: false, error: '', fetched: true },
        }));
      } catch (e) {
        console.error(e);
        const message = getErrorMessage(e);
        setChildrenCache((prev) => ({
          ...prev,
          [key]: { items: [], loading: false, error: message, fetched: true },
        }));
        toast.error(message);
      }
    },
    [toast],
  );

  const toggleChildrenDrawer = (parent) => {
    const key = parentRowKey(parent);
    if (!key) return;

    if (expandedParentId === key) {
      setExpandedParentId(null);
      return;
    }

    setExpandedParentId(key);
    const cached = childrenCache[key];
    if (!cached?.fetched && !cached?.loading) {
      fetchChildrenForParent(parent);
    }
  };

  const closeChildrenDrawer = () => setExpandedParentId(null);

  const patchParentLocal = (parentId, patch) => {
    setParents((prev) =>
      prev.map((p) => (p.parent_id === parentId ? { ...p, ...patch } : p)),
    );
  };

  const handleSuspend = async () => {
    const parent = suspendTarget;
    if (!parent || busyParentId) return;
    try {
      setBusyParentId(parent.parent_id);
      const { data } = await adminModel.users.suspend(parent.parent_id);
      patchParentLocal(parent.parent_id, data);
      setSuspendTarget(null);
      toast.success('Parent suspended.');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusyParentId(null);
    }
  };

  const handleReactivate = async () => {
    const parent = reactivateTarget;
    if (!parent || busyParentId) return;
    try {
      setBusyParentId(parent.parent_id);
      const { data } = await adminModel.users.reactivate(parent.parent_id);
      patchParentLocal(parent.parent_id, data);
      setReactivateTarget(null);
      toast.success('Parent reactivated.');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusyParentId(null);
    }
  };

  const handleDelete = async () => {
    const parent = deleteTarget;
    if (!parent?.parent_id || busyParentId) return;
    try {
      setBusyParentId(parent.parent_id);
      await adminModel.users.delete(parent.parent_id);
      setParents((prev) => prev.filter((p) => p.parent_id !== parent.parent_id));
      setDeleteTarget(null);
      toast.success('Parent deleted.');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusyParentId(null);
    }
  };

  const parentsTable = useAdminTable(parents, {
    filterFn: (p) => {
      if (suspendedFilter === 'suspended' && !p.is_suspended) return false;
      if (suspendedFilter === 'active' && p.is_suspended) return false;
      if (verifiedFilter === 'verified' && !p.is_verified) return false;
      if (verifiedFilter === 'unverified' && p.is_verified) return false;
      return true;
    },
    searchFn: (p, q) =>
      `${p.full_name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(q),
  });

  return (
    <div>
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>
              Parents Directory
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
              {parents.length} registered parent{parents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Search name or email…"
              value={parentsTable.search}
              onChange={(e) => parentsTable.setSearch(e.target.value)}
              style={{ ...inputStyle, width: 200 }}
            />
            <select
              value={suspendedFilter}
              onChange={(e) => {
                setSuspendedFilter(e.target.value);
                parentsTable.setFilterReset();
              }}
              style={{ ...selectStyle, width: 130 }}
              aria-label="Filter by suspension"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="suspended">Suspended only</option>
            </select>
            <select
              value={verifiedFilter}
              onChange={(e) => {
                setVerifiedFilter(e.target.value);
                parentsTable.setFilterReset();
              }}
              style={{ ...selectStyle, width: 140 }}
              aria-label="Filter by verification"
            >
              <option value="all">All verification</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            overflow: 'auto',
          }}
        >
          {loading ? (
            <TableSkeleton cols={9} rows={8} />
          ) : parentsTable.total === 0 ? (
            <div className="p-12 text-center text-[var(--muted)]">No parents match your search or filters.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {[
                    'Full Name',
                    'Email',
                    'Gender',
                    'Age',
                    'Phone',
                    'Join Date',
                    'Children',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parentsTable.filtered.map((p) => {
                  const rowKey = parentRowKey(p);
                  const isExpanded = expandedParentId === rowKey;

                  return (
                    <Fragment key={rowKey}>
                      <tr
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                          background: isExpanded ? 'rgba(var(--green-rgb),0.04)' : 'transparent',
                        }}
                      >
                        <td style={{ ...td, fontWeight: 600 }}>{p.full_name || '—'}</td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{p.email ?? '—'}</td>
                        <td style={td}>{p.gender ?? '—'}</td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{p.age ?? '—'}</td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{p.phone ?? '—'}</td>
                        <td style={td}>
                          <RelativeTime value={p.created_at} className="text-[var(--muted)]" />
                        </td>
                        <td style={{ ...td, fontFamily: 'var(--mono)', fontWeight: 700 }}>{p.children_count ?? 0}</td>
                        <td style={td}>
                          <StatusBadge parent={p} />
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <ActionButton tone="accent" onClick={() => toggleChildrenDrawer(p)}>
                              {isExpanded ? 'Hide Children' : 'View Children'}
                            </ActionButton>
                            {p.is_suspended ? (
                              <ActionButton
                                tone="accent"
                                disabled={busyParentId === p.parent_id}
                                onClick={() => setReactivateTarget(p)}
                              >
                                Reactivate
                              </ActionButton>
                            ) : (
                              <ActionButton
                                tone="warn"
                                disabled={busyParentId === p.parent_id}
                                onClick={() => setSuspendTarget(p)}
                              >
                                Suspend
                              </ActionButton>
                            )}
                            <ActionButton
                              tone="danger"
                              disabled={busyParentId === p.parent_id}
                              onClick={() => setDeleteTarget(p)}
                            >
                              Delete
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <ParentChildrenDrawer
                              parent={p}
                              cache={childrenCache[rowKey]}
                              onClose={closeChildrenDrawer}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        title="Suspend parent?"
        message={`Suspend "${suspendTarget?.full_name || suspendTarget?.email}"? They will not be able to sign in.`}
        confirmLabel="Suspend"
        danger
        submitting={Boolean(busyParentId)}
        onCancel={() => !busyParentId && setSuspendTarget(null)}
        onConfirm={handleSuspend}
      />

      <ConfirmDialog
        open={Boolean(reactivateTarget)}
        title="Reactivate parent?"
        message={`Restore access for "${reactivateTarget?.full_name || reactivateTarget?.email}"?`}
        confirmLabel="Reactivate"
        tone="accent"
        submitting={Boolean(busyParentId)}
        onCancel={() => !busyParentId && setReactivateTarget(null)}
        onConfirm={handleReactivate}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete parent?"
        message={`Permanently delete "${deleteTarget?.full_name || deleteTarget?.email}"? This also removes their auth account when linked.`}
        confirmLabel="Yes, delete"
        danger
        submitting={Boolean(busyParentId)}
        onCancel={() => !busyParentId && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
