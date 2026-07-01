import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { therapistApi } from '../../lib/therapistApi';
import {
  getMeetingStartWindowStatus,
  mergeAppointmentZoom,
  openTherapistZoom,
  therapistZoomUrl,
} from '../../lib/therapistMeeting.js';
import { sortRowsByDate } from '../../lib/sortByDate';
import { DateSortSelect } from '../../components/therapist/ui/TherapistUI';
import { getErrorMessage } from '../../utils/errorMessages.js';

function ageLabel(rawDob) {
  if (!rawDob) return '—';
  const dob = new Date(rawDob);
  if (Number.isNaN(dob.getTime())) return '—';
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) months = 0;
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}y` : `${y}y ${m}mo`;
}

function normalizeStatus(raw) {
  return String(raw || 'pending').toLowerCase().trim();
}

function isMeetingRow(row) {
  const status = normalizeStatus(row.status);
  return status === 'confirmed' || status === 'completed';
}

function isPendingAppointmentRow(row) {
  const status = normalizeStatus(row.status);
  return status === 'pending' || status === 'cancellation_requested';
}

function appointmentStatusBadge(status) {
  if (status === 'cancellation_requested') {
    return {
      label: 'CANCEL REQUESTED',
      bg: 'rgba(251,146,60,0.16)',
      color: '#fb923c',
    };
  }
  if (status === 'pending') {
    return {
      label: 'PENDING',
      bg: 'rgba(250,204,21,0.14)',
      color: '#facc15',
    };
  }
  if (status === 'cancelled' || status === 'canceled') {
    return {
      label: 'CANCELLED',
      bg: 'rgba(239,68,68,0.16)',
      color: '#ef4444',
    };
  }
  return {
    label: status.toUpperCase(),
    bg: 'rgba(148,163,184,0.16)',
    color: '#94a3b8',
  };
}

function meetingStatusBadge(row) {
  const status = normalizeStatus(row.status);
  if (status === 'completed') {
    return { label: 'COMPLETED', bg: 'rgba(96,165,250,0.14)', color: '#60a5fa' };
  }
  if (row.is_started) {
    return { label: 'LIVE', bg: 'rgba(var(--green-rgb),0.12)', color: 'var(--green)' };
  }
  const windowStatus = getMeetingStartWindowStatus(row);
  if (windowStatus.status === 'ended') {
    return { label: 'ENDED', bg: 'rgba(148,163,184,0.16)', color: '#94a3b8' };
  }
  return { label: 'SCHEDULED', bg: 'rgba(167,139,250,0.14)', color: '#a78bfa' };
}

export default function TherapistAppointments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
  const [dateSort, setDateSort] = useState('asc');
  const [actionBusy, setActionBusy] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    row: null,
    action: '',
  });
  const [meetingTimeAlert, setMeetingTimeAlert] = useState({
    open: false,
    message: '',
  });
  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const data = await therapistApi.appointments.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setListError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matched = rows.filter((r) => {
      if (!isPendingAppointmentRow(r)) return false;
      const haystack = `${r.parent_name ?? ''} ${r.child_name ?? ''} ${r.appointment_date ?? ''}`
        .toLowerCase();
      return haystack.includes(q);
    });
    return sortRowsByDate(matched, {
      dateKey: 'appointment_date',
      getTime: (r) => r.appointment_start_time || r.appointment_time,
      direction: dateSort,
    });
  }, [rows, query, dateSort]);

  const meetingRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matched = rows.filter((r) => {
      if (!isMeetingRow(r)) return false;
      const haystack = `${r.parent_name ?? ''} ${r.child_name ?? ''} ${r.appointment_date ?? ''}`
        .toLowerCase();
      return haystack.includes(q);
    });
    return sortRowsByDate(matched, {
      dateKey: 'appointment_date',
      getTime: (r) => r.appointment_start_time || r.appointment_time,
      direction: dateSort,
    });
  }, [rows, query, dateSort]);

  const runDecision = async (row, action) => {
    const appointmentId = row.appointments_id;
    setActionBusy((prev) => ({ ...prev, [appointmentId]: action }));
    setActionError('');
    try {
      const data = await therapistApi.appointments.decision(appointmentId, action);
      setRows((prev) =>
        prev.map((r) =>
          r.appointments_id === appointmentId
            ? {
                ...r,
                status: data.status,
                zoom_join_url: data.zoom_join_url ?? r.zoom_join_url,
                zoom_password: data.zoom_password ?? r.zoom_password,
                zoom_start_url: data.zoom_start_url ?? r.zoom_start_url,
                zoom_meeting_id: data.zoom_meeting_id ?? r.zoom_meeting_id,
              }
            : r,
        ),
      );
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setActionBusy((prev) => ({ ...prev, [appointmentId]: '' }));
    }
  };

  const runStartMeeting = async (row) => {
    const windowStatus = getMeetingStartWindowStatus(row);
    if (windowStatus.status !== 'ok') {
      setMeetingTimeAlert({
        open: true,
        message: windowStatus.message || 'This meeting cannot be started right now.',
      });
      return;
    }

    const appointmentId = row.appointments_id;
    setActionBusy((prev) => ({ ...prev, [appointmentId]: 'start' }));
    setActionError('');
    try {
      const data = await therapistApi.appointments.start(appointmentId);
      const merged = mergeAppointmentZoom(row, data);
      setRows((prev) =>
        prev.map((r) => (r.appointments_id === appointmentId ? merged : r)),
      );
      if (!openTherapistZoom(merged)) {
      setActionError(
          'Could not open Zoom. Check server Zoom credentials or try again.',
        );
      }
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setActionBusy((prev) => ({ ...prev, [appointmentId]: '' }));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>
          Appointments
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          Pending requests awaiting your confirmation. Confirmed sessions appear under Meetings.
        </p>
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <input
            placeholder="Filter by parent, child, or date..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: 320,
              maxWidth: '100%',
              padding: '9px 11px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font)',
              outline: 'none',
            }}
          />
          <DateSortSelect
            id="appointments-date-sort"
            value={dateSort}
            onChange={setDateSort}
          />
        </div>
      </div>

      {actionError ? (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {actionError}
        </div>
      ) : null}

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
        ) : listError && rows.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--danger)' }}>{listError}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            No pending appointments.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {['Parent Name', 'Child Name', 'Child Age', 'Parent Email', 'Date', 'Start', 'End', 'Status', 'Child files', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 14px',
                      textAlign: 'left',
                      color: 'var(--muted)',
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const appointmentId = r.appointments_id;
                const status = normalizeStatus(r.status);
                const cancelRequested = status === 'cancellation_requested';
                const statusBadge = appointmentStatusBadge(status);
                return (
                <tr key={appointmentId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px' }}>{r.parent_name || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>{r.child_name || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>{r.child_age || ageLabel(r.child_dob)}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>{r.parent_email || '—'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>{r.appointment_date || '—'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>
                    {r.appointment_start_time || r.appointment_time || '—'}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>
                    {r.appointment_end_time || '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {statusBadge.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {cancelRequested && (
                        <button
                          type="button"
                          onClick={() => setConfirmDialog({ open: true, row: r, action: 'reject' })}
                          disabled={Boolean(actionBusy[appointmentId])}
                          style={{
                            border: '1px solid #fb923c',
                            color: '#fb923c',
                            background: 'transparent',
                            borderRadius: 8,
                            padding: '4px 10px',
                            fontSize: 12,
                            cursor: 'pointer',
                            opacity: Boolean(actionBusy[appointmentId]) ? 0.55 : 1,
                          }}
                        >
                          {actionBusy[appointmentId] === 'reject'
                            ? 'Approving…'
                            : 'Approve cancellation'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDialog({ open: true, row: r, action: 'confirm' })}
                        disabled={Boolean(actionBusy[appointmentId]) || cancelRequested}
                        style={{
                          border: '1px solid var(--green)',
                          color: 'var(--green)',
                          background: 'transparent',
                          borderRadius: 8,
                          padding: '4px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          opacity: Boolean(actionBusy[appointmentId]) || cancelRequested ? 0.55 : 1,
                        }}
                      >
                        {actionBusy[appointmentId] === 'confirm' ? 'Confirming...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDialog({ open: true, row: r, action: 'reject' })}
                        disabled={Boolean(actionBusy[appointmentId]) || cancelRequested}
                        style={{
                          border: '1px solid var(--danger)',
                          color: 'var(--danger)',
                          background: 'transparent',
                          borderRadius: 8,
                          padding: '4px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          opacity: Boolean(actionBusy[appointmentId]) || cancelRequested ? 0.55 : 1,
                        }}
                      >
                        {actionBusy[appointmentId] === 'reject' ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
          Meetings
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4, marginBottom: 16 }}>
          Confirmed and completed Zoom sessions stay here after the scheduled time ends.
        </p>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
          ) : listError && rows.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--danger)' }}>{listError}</div>
          ) : meetingRows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              No meetings yet. Confirmed appointments appear here.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {['Parent Name', 'Child Name', 'Date', 'Start', 'End', 'Meeting status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        color: 'var(--muted)',
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meetingRows.map((r) => {
                  const appointmentId = r.appointments_id;
                  const status = normalizeStatus(r.status);
                  const badge = meetingStatusBadge(r);
                  const started = r.is_started === true;
                  const canStart = status === 'confirmed' && !started;
                  const canJoin = started && therapistZoomUrl(r);
                  return (
                    <tr key={appointmentId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px' }}>{r.parent_name || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>{r.child_name || '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>{r.appointment_date || '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>
                        {r.appointment_start_time || r.appointment_time || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>
                        {r.appointment_end_time || '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            padding: '2px 10px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {canJoin && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!openTherapistZoom(r)) {
                                  setError('Zoom link is missing for this session.');
                                }
                              }}
                              style={{
                                border: '1px solid #a78bfa',
                                color: '#a78bfa',
                                background: 'transparent',
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Join
                            </button>
                          )}
                          {canStart && (() => {
                            const meetWindow = getMeetingStartWindowStatus(r);
                            const canStartNow =
                              meetWindow.status === 'ok' || meetWindow.status === 'unknown';
                            return (
                            <button
                              type="button"
                              title={
                                !canStartNow
                                  ? meetWindow.message
                                  : therapistZoomUrl(r)
                                    ? 'Open Zoom as host'
                                    : 'Creates a Zoom meeting, then opens it'
                              }
                              onClick={() => runStartMeeting(r)}
                              disabled={Boolean(actionBusy[appointmentId]) || !canStartNow}
                              style={{
                                border: '1px solid #a78bfa',
                                color: '#a78bfa',
                                background: 'transparent',
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                opacity:
                                  Boolean(actionBusy[appointmentId]) || !canStartNow ? 0.55 : 1,
                              }}
                            >
                              {actionBusy[appointmentId] === 'start'
                                ? 'Starting…'
                                : 'Start meeting'}
                            </button>
                            );
                          })()}
                          {status === 'completed' && r.child_id && (
                            <Link
                              to={`/therapist/children/${r.child_id}`}
                              state={{ fromAppointment: appointmentId }}
                              style={{
                                color: 'var(--accent)',
                                fontWeight: 600,
                                fontSize: 12,
                                textDecoration: 'none',
                                alignSelf: 'center',
                              }}
                            >
                              Review child
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {confirmDialog.open && (
        <div className="confirm-dialog-backdrop" style={{ zIndex: 1000 }}>
          <div className="confirm-dialog-panel" style={{ maxWidth: '460px' }}>
            <h3 className="confirm-dialog-title" style={{ marginBottom: 16 }}>
              {confirmDialog.action === 'confirm'
                ? 'Are you sure you want to confirm appointment?'
                : 'Are you sure you want to reject appointment?'}
            </h3>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmDialog({ open: false, row: null, action: '' })}
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { row, action } = confirmDialog;
                  setConfirmDialog({ open: false, row: null, action: '' });
                  if (row && action) await runDecision(row, action);
                }}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${confirmDialog.action === 'confirm' ? 'var(--green)' : 'var(--danger)'}`,
                  background: 'transparent',
                  color: confirmDialog.action === 'confirm' ? 'var(--green)' : 'var(--danger)',
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {confirmDialog.action === 'confirm'
                  ? 'Confirm'
                  : normalizeStatus(confirmDialog.row?.status) === 'cancellation_requested'
                    ? 'Approve cancellation'
                    : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {meetingTimeAlert.open && (
        <div className="confirm-dialog-backdrop" style={{ zIndex: 1000 }}>
          <div className="confirm-dialog-panel" style={{ maxWidth: '420px' }}>
            <h3 className="confirm-dialog-title" style={{ marginBottom: 12 }}>
              Cannot start meeting
            </h3>
            <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
              {meetingTimeAlert.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setMeetingTimeAlert({ open: false, message: '' })}
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  padding: '6px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

