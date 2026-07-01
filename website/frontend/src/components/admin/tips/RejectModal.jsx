import { getUserFacingError } from '../../../utils/errorFeedback.js';
import { useState } from 'react';
import api from '../../../services/axios.js';
import { AdminAlert, DialogButton, DialogFooter } from '../ui';

export default function RejectModal({ tipId, tipTitle, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const trimmed = reason.trim();
  const valid = trimmed.length >= 10;

  const handleConfirm = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/tips/${tipId}/reject`, { rejection_reason: trimmed });
      onConfirm?.();
    } catch (err) {
      setError(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="confirm-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-tip-title"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose?.()}
    >
      <div className="confirm-dialog-panel" onClick={(e) => e.stopPropagation()}>
        <h3 id="reject-tip-title" className="confirm-dialog-title">
          Reject tip
        </h3>
        <p className="confirm-dialog-message">
          Rejecting <strong className="text-[var(--text)]">{tipTitle || 'this tip'}</strong>. The submitter will see your reason.
        </p>

        {error ? <AdminAlert>{error}</AdminAlert> : null}

        <div className="mt-4">
          <label htmlFor="reject-reason" className="block text-xs font-medium text-[var(--muted)] mb-2">
            Reason for rejection
          </label>
          <textarea
            id="reject-reason"
            className="admin-input"
            style={{ minHeight: 100, resize: 'vertical' }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            maxLength={500}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            {trimmed.length}/10 minimum characters
          </p>
        </div>

        <DialogFooter>
          <DialogButton disabled={submitting} onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton variant="danger" disabled={!valid || submitting} onClick={handleConfirm}>
            {submitting ? 'Rejecting…' : 'Confirm rejection'}
          </DialogButton>
        </DialogFooter>
      </div>
    </div>
  );
}
