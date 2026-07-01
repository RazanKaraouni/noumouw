import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { therapistApi } from '../../lib/therapistApi';
import { Btn, Badge, GlassCard, Skeleton, DateSortSelect } from './ui/TherapistUI';
import { sortRowsByDate } from '../../lib/sortByDate';
import {
  validateSlotDate,
  validateSlotTimeRange,
  validateSlotAgainstExisting,
  minSlotDateInputValue,
  maxSlotDateInputValue,
  SLOT_DATE_NOT_ALLOWED_MESSAGE,
} from '../../utils/slotTime.js';

const label = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 8,
  color: 'var(--muted)',
};

const input = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font)',
  boxSizing: 'border-box',
  marginBottom: 16,
};

const buttonBase = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};

function toDateInputValue(v) {
  if (!v) return '';
  return String(v).slice(0, 10);
}

const SLOT_OPEN_TIME = '08:00';
const SLOT_CLOSE_TIME = '20:00';

function SlotsTable({ viewState, rows, onEdit, onDelete }) {
  if (viewState === 'loading') {
    return <Skeleton style={{ height: 120 }} />;
  }
  if (viewState === 'error') {
    return (
      <p style={{ color: 'var(--danger)', fontSize: 14 }}>
        We could not load your availability. Please refresh and try again.
      </p>
    );
  }
  if (!rows?.length) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        No slots yet. Add a date and time range on the right.
      </p>
    );
  }
  return (
    <div className="td-availability-table-wrap">
      <table className="td-availability-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Start</th>
            <th>End</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.availability_id || `${r.slot_date}-${r.start_time}`}>
              <td>{r.slot_date}</td>
              <td>{String(r.start_time ?? '').slice(0, 5)}</td>
              <td>{String(r.end_time ?? '').slice(0, 5)}</td>
              <td>
                <Badge tone={r.is_booked ? 'default' : 'success'}>
                  {r.is_booked ? 'Booked' : 'Open'}
                </Badge>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={buttonBase} onClick={() => onEdit(r)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    style={{ ...buttonBase, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    onClick={() => onDelete(r)}
                    disabled={r.is_booked}
                    title={r.is_booked ? 'Cannot delete a booked slot' : 'Delete slot'}
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
  );
}

/** Add / edit / delete availability slots — used on dashboard and /availability page. */
export default function TherapistAvailabilityPanel({ embedded = false, onSlotsChange }) {
  const { user } = useAuth();
  const [slotDate, setSlotDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewState, setViewState] = useState('loading');
  const [rows, setRows] = useState([]);
  const [dialog, setDialog] = useState({ open: false, type: 'delete', row: null });
  const [editDate, setEditDate] = useState('');
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('10:00');
  const [dialogErr, setDialogErr] = useState('');
  const [dialogBusy, setDialogBusy] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ open: false, title: '', message: '' });
  const [dateSort, setDateSort] = useState('asc');
  const dateInputRef = useRef(null);

  const loadSlots = async () => {
    setViewState('loading');
    setError('');
    try {
      const data = await therapistApi.availability.list();
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setViewState('success');
      onSlotsChange?.(list);
    } catch (e) {
      setError(getUserFacingError(e));
      setViewState('error');
    }
  };

  useEffect(() => {
    if (user?.role === 'therapist') loadSlots();
    else setViewState('success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    const dateVal = String(slotDate || dateInputRef.current?.value || '').trim();
    if (!dateVal) {
      if (dateInputRef.current?.validity?.rangeUnderflow) {
        setError(SLOT_DATE_NOT_ALLOWED_MESSAGE);
      } else {
        setError('Choose a date.');
      }
      return;
    }
    const dateCheck = validateSlotDate(dateVal);
    if (!dateCheck.ok) {
      setError(dateCheck.message);
      return;
    }
    const startVal = startTime.length === 5 ? `${startTime}:00` : startTime;
    const endVal = endTime.length === 5 ? `${endTime}:00` : endTime;
    const timeCheck = validateSlotTimeRange(startVal, endVal);
    if (!timeCheck.ok) {
      setError(timeCheck.message);
      return;
    }
    const conflictCheck = validateSlotAgainstExisting(
      rows,
      dateCheck.dateStr,
      startVal,
      endVal,
    );
    if (!conflictCheck.ok) {
      setError(conflictCheck.message);
      return;
    }
    setSubmitting(true);
    try {
      await therapistApi.availability.create({
        slot_date: dateCheck.dateStr,
        start_time: startVal,
        end_time: endVal,
      });
      setMessage('Slot saved — parents can book when it stays open.');
      setSlotDate('');
      await loadSlots();
    } catch (e) {
      setError(getUserFacingError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (row) => {
    if (row.is_booked) {
      setAlertDialog({
        open: true,
        title: 'Slot booked',
        message: 'This slot is already booked and cannot be deleted.',
      });
      return;
    }
    setDialog({ open: true, type: 'delete', row });
    setDialogErr('');
  };

  const openEditDialog = (row) => {
    setDialog({ open: true, type: 'edit', row });
    setEditDate(toDateInputValue(row.slot_date));
    setEditStart(String(row.start_time || '').slice(0, 5) || '09:00');
    setEditEnd(String(row.end_time || '').slice(0, 5) || '10:00');
    setDialogErr('');
  };

  const closeDialog = () => {
    if (dialogBusy) return;
    setDialog({ open: false, type: 'delete', row: null });
    setDialogErr('');
  };

  const confirmDelete = async () => {
    const availabilityId = dialog.row?.availability_id;
    if (!availabilityId) return;
    setDialogBusy(true);
    setDialogErr('');
    try {
      await therapistApi.availability.remove(availabilityId);
      closeDialog();
      await loadSlots();
    } catch (e) {
      setDialogErr(e.message || 'Could not delete slot.');
    } finally {
      setDialogBusy(false);
    }
  };

  const confirmEdit = async () => {
    const availabilityId = dialog.row?.availability_id;
    if (!availabilityId) return;
    const startVal = editStart.length === 5 ? `${editStart}:00` : editStart;
    const endVal = editEnd.length === 5 ? `${editEnd}:00` : editEnd;
    const editDateVal = String(editDate || '').trim();
    if (!editDateVal) {
      setDialogErr('Choose a date.');
      return;
    }
    const dateCheck = validateSlotDate(editDateVal);
    if (!dateCheck.ok) {
      setDialogErr(dateCheck.message);
      return;
    }
    const timeCheck = validateSlotTimeRange(startVal, endVal);
    if (!timeCheck.ok) {
      setDialogErr(timeCheck.message);
      return;
    }
    const conflictCheck = validateSlotAgainstExisting(
      rows,
      dateCheck.dateStr,
      startVal,
      endVal,
      availabilityId,
    );
    if (!conflictCheck.ok) {
      setDialogErr(conflictCheck.message);
      return;
    }
    setDialogBusy(true);
    setDialogErr('');
    try {
      await therapistApi.availability.update(availabilityId, {
        slot_date: dateCheck.dateStr,
        start_time: startVal,
        end_time: endVal,
      });
      closeDialog();
      await loadSlots();
    } catch (e) {
      setDialogErr(e.message || 'Could not update slot.');
    } finally {
      setDialogBusy(false);
    }
  };

  const openCount = useMemo(() => rows.filter((r) => !r.is_booked).length, [rows]);

  const sortedRows = useMemo(
    () =>
      sortRowsByDate(rows, {
        dateKey: 'slot_date',
        timeKey: 'start_time',
        direction: dateSort,
      }),
    [rows, dateSort],
  );

  return (
    <div className={embedded ? 'td-availability-embedded' : ''} style={{ maxWidth: embedded ? 'none' : 900 }}>
      {!embedded && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 28 }}>
            Manage availability
          </h1>
        </>
      )}

      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 className="td-section-title">Availability</h2>
            <p className="td-subtitle" style={{ marginTop: 4, marginBottom: 0 }}>
              Add time slots for parents to book appointments.
            </p>
          </div>
          <Badge tone="success">{openCount} open slot{openCount === 1 ? '' : 's'}</Badge>
        </div>
      )}

      <div className="td-availability-grid">
        <GlassCard>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <h3 style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>Your slots</h3>
            <DateSortSelect
              id="availability-date-sort"
              value={dateSort}
              onChange={setDateSort}
            />
          </div>
          <SlotsTable
            viewState={viewState}
            rows={sortedRows}
            onEdit={openEditDialog}
            onDelete={openDeleteDialog}
          />
        </GlassCard>

        <GlassCard>
          <h3 style={{ fontSize: 16, marginBottom: 6, fontWeight: 600 }}>Add a time range</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14, marginTop: 0 }}>
            Choose a date from tomorrow onward. Slots must be between 8:00 AM and 8:00 PM.
          </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="slot-date" style={label}>Date</label>
            <input
              id="slot-date"
              ref={dateInputRef}
              type="date"
              className="td-input"
              value={slotDate}
              min={minSlotDateInputValue()}
              max={maxSlotDateInputValue()}
              onChange={(ev) => {
                setSlotDate(ev.target.value);
                setError('');
              }}
              style={input}
            />
            <label htmlFor="start-t" style={label}>Start time</label>
            <input
              id="start-t"
              type="time"
              className="td-input"
              value={startTime}
              min={SLOT_OPEN_TIME}
              max={SLOT_CLOSE_TIME}
              onChange={(ev) => setStartTime(ev.target.value)}
              style={input}
            />
            <label htmlFor="end-t" style={label}>End time</label>
            <input
              id="end-t"
              type="time"
              className="td-input"
              value={endTime}
              min={SLOT_OPEN_TIME}
              max={SLOT_CLOSE_TIME}
              onChange={(ev) => setEndTime(ev.target.value)}
              style={input}
            />
            {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</p>}
            {message && <p style={{ color: 'var(--accent)', marginBottom: 12, fontSize: 13 }}>{message}</p>}
            <button type="submit" className="td-btn td-btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save availability'}
            </button>
          </form>
        </GlassCard>
      </div>

      {dialog.open && (
        <div className="td-modal-backdrop" role="presentation" onClick={closeDialog}>
          <div className="td-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            {dialog.type === 'delete' ? (
              <>
                <h3 className="td-modal-title">Delete slot?</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>This removes the availability slot permanently.</p>
                {dialogErr && <p style={{ color: 'var(--danger)' }}>{dialogErr}</p>}
                <div className="td-modal-footer">
                  <Btn variant="ghost" onClick={closeDialog}>Cancel</Btn>
                  <Btn variant="danger" onClick={confirmDelete} disabled={dialogBusy}>
                    {dialogBusy ? 'Deleting…' : 'Delete'}
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <h3 className="td-modal-title">Edit slot</h3>
                <label style={label}>Date</label>
                <input
                  type="date"
                  className="td-input"
                  value={editDate}
                  min={minSlotDateInputValue()}
                  max={maxSlotDateInputValue()}
                  onChange={(e) => setEditDate(e.target.value)}
                  style={input}
                />
                <label style={label}>Start</label>
                <input
                  type="time"
                  className="td-input"
                  value={editStart}
                  min={SLOT_OPEN_TIME}
                  max={SLOT_CLOSE_TIME}
                  onChange={(e) => setEditStart(e.target.value)}
                  style={input}
                />
                <label style={label}>End</label>
                <input
                  type="time"
                  className="td-input"
                  value={editEnd}
                  min={SLOT_OPEN_TIME}
                  max={SLOT_CLOSE_TIME}
                  onChange={(e) => setEditEnd(e.target.value)}
                  style={input}
                />
                {dialogErr && <p style={{ color: 'var(--danger)' }}>{dialogErr}</p>}
                <div className="td-modal-footer">
                  <Btn variant="ghost" onClick={closeDialog}>Cancel</Btn>
                  <Btn variant="primary" onClick={confirmEdit} disabled={dialogBusy}>
                    {dialogBusy ? 'Saving…' : 'Save'}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {alertDialog.open && (
        <div className="td-modal-backdrop" role="presentation">
          <div className="td-modal">
            <h3 className="td-modal-title">{alertDialog.title}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>{alertDialog.message}</p>
            <div className="td-modal-footer">
              <Btn variant="primary" onClick={() => setAlertDialog({ open: false, title: '', message: '' })}>
                OK
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
