import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { therapistModel } from '../../models/therapistModel.js';
import {
  getMeetingStartWindowStatus,
  mergeAppointmentZoom,
  openTherapistZoom,
  therapistZoomUrl,
} from '../../lib/therapistMeeting.js';
import { Badge, Btn, GlassCard, Skeleton } from './ui/TherapistUI.jsx';

function appointmentStartDate(row) {
  const date = String(row.appointment_date || '').slice(0, 10);
  const time = String(row.appointment_start_time || row.appointment_time || '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isUpcomingMeeting(row) {
  const status = String(row.status || '').toLowerCase();
  if (status !== 'confirmed') return false;
  const start = appointmentStartDate(row);
  if (!start) return true;
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  return start >= cutoff;
}

function meetingStatusBadge(row) {
  if (row.is_started) {
    return { label: 'LIVE', tone: 'success' };
  }
  const windowStatus = getMeetingStartWindowStatus(row);
  if (windowStatus.status === 'ended') {
    return { label: 'ENDED', tone: 'default' };
  }
  return { label: 'SCHEDULED', tone: 'info' };
}

export default function DashboardMeetingsPanel({ refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [meetingTimeAlert, setMeetingTimeAlert] = useState({
    open: false,
    message: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await therapistModel.appointments.list();
      const list = Array.isArray(data) ? data : [];
      setRows(list.filter(isUpcomingMeeting));
    } catch (e) {
      setError(getUserFacingError(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = appointmentStartDate(a)?.getTime() ?? 0;
      const db = appointmentStartDate(b)?.getTime() ?? 0;
      return da - db;
    });
  }, [rows]);

  const handleStart = async (row) => {
    const windowStatus = getMeetingStartWindowStatus(row);
    if (windowStatus.status !== 'ok') {
      setMeetingTimeAlert({
        open: true,
        message: windowStatus.message || 'This meeting cannot be started right now.',
      });
      return;
    }

    const id = row.appointments_id;
    setBusyId(id);
    setError('');
    try {
      const data = await therapistModel.appointments.start(id);
      const merged = mergeAppointmentZoom(row, data);
      setRows((prev) => prev.map((r) => (r.appointments_id === id ? merged : r)));
      if (!openTherapistZoom(merged)) {
        setError('Zoom link is not available yet. Try again in a moment.');
      }
    } catch (e) {
      setError(getUserFacingError(e));
    } finally {
      setBusyId('');
    }
  };

  const handleJoin = (row) => {
    if (!openTherapistZoom(row)) {
      setError('Zoom link is missing for this session.');
    }
  };

  return (
    <GlassCard className="td-dashboard-panel td-meetings-panel">
      <div className="td-dashboard-panel-head">
        <h2 className="td-dashboard-panel-title">Upcoming meetings</h2>
        <p className="td-dashboard-panel-sub">
          Confirmed Zoom sessions on your calendar. Start a meeting so parents can join from their app.
        </p>
      </div>

      {error ? (
        <p className="td-alert td-alert-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      <div className="td-dashboard-panel-body">
        {loading ? (
          <div className="td-meetings-skeleton">
            <Skeleton style={{ height: 48, marginBottom: 8 }} />
            <Skeleton style={{ height: 48, marginBottom: 8 }} />
            <Skeleton style={{ height: 48 }} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="td-empty">
            <p>No upcoming Zoom meetings</p>
            <p className="td-meta">Confirmed upcoming appointments appear here.</p>
          </div>
        ) : (
          <div className="td-meetings-table-wrap">
            <table className="td-meetings-table">
              <thead>
                <tr>
                  {['Child', 'Parent', 'Date', 'Time', 'Status', ''].map((h) => (
                    <th key={h || 'actions'}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const id = row.appointments_id;
                  const badge = meetingStatusBadge(row);
                  const started = row.is_started === true;
                  const canStart = !started;
                  const canJoin = started && therapistZoomUrl(row);
                  const meetWindow = getMeetingStartWindowStatus(row);
                  const canStartNow = meetWindow.status === 'ok' || meetWindow.status === 'unknown';

                  return (
                    <tr key={id}>
                      <td>{row.child_name || '—'}</td>
                      <td>{row.parent_name || '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>{row.appointment_date || '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>
                        {row.appointment_start_time || row.appointment_time || '—'}
                      </td>
                      <td>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                      <td className="td-meetings-actions">
                        {canJoin ? (
                          <Btn variant="ghost" onClick={() => handleJoin(row)}>
                            Join
                          </Btn>
                        ) : null}
                        {canStart ? (
                          <Btn
                            variant="accent"
                            disabled={busyId === id || !canStartNow}
                            title={!canStartNow ? meetWindow.message : undefined}
                            onClick={() => handleStart(row)}
                          >
                            {busyId === id ? 'Starting…' : 'Start meeting'}
                          </Btn>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meetingTimeAlert.open ? (
        <div className="confirm-dialog-backdrop" style={{ zIndex: 1000 }}>
          <div className="confirm-dialog-panel" style={{ maxWidth: '420px' }}>
            <h3 className="confirm-dialog-title" style={{ marginBottom: 12 }}>
              Cannot start meeting
            </h3>
            <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
              {meetingTimeAlert.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn
                variant="ghost"
                onClick={() => setMeetingTimeAlert({ open: false, message: '' })}
              >
                OK
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}
