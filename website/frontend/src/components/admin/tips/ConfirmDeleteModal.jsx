import { getUserFacingError } from '../../../utils/errorFeedback.js';
import { useState } from 'react';
import api from '../../../services/axios.js';
import { AdminAlert, DialogButton, DialogFooter } from '../ui';

export default function ConfirmDeleteModal({ tip, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.delete(`/tips/${tip.tip_id ?? tip.id}`);
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
      aria-labelledby="delete-tip-title"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose?.()}
    >
      <div className="confirm-dialog-panel" onClick={(e) => e.stopPropagation()}>
        <h3 id="delete-tip-title" className="confirm-dialog-title">
          Delete tip
        </h3>
        <p className="confirm-dialog-message">
          Are you sure you want to permanently delete{' '}
          <strong className="text-[var(--text)]">{tip?.title || 'this tip'}</strong>?
        </p>
        {error ? <AdminAlert>{error}</AdminAlert> : null}
        <DialogFooter>
          <DialogButton disabled={submitting} onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton variant="danger" disabled={submitting} onClick={handleConfirm}>
            {submitting ? 'Deleting…' : 'Delete'}
          </DialogButton>
        </DialogFooter>
      </div>
    </div>
  );
}
