import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useState } from 'react';
import apiClient from '../../services/axios.js';
import { Modal, Btn } from '../therapist/ui/TherapistUI.jsx';

export default function ConfirmDeleteModal({ tip, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await apiClient.delete(`/tips/${tip.tip_id ?? tip.id}`);
      onConfirm?.();
    } catch (err) {
      setError(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="Delete tip"
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Btn>
          <Btn variant="danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Deleting…' : 'Delete'}
          </Btn>
        </>
      }
    >
      {error && <div className="td-alert td-alert-error">{error}</div>}
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
        Are you sure you want to delete{' '}
        <strong>{tip?.title || 'this tip'}</strong>? This cannot be undone.
      </p>
    </Modal>
  );
}
