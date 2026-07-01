import { DialogButton, DialogFooter } from './DialogButtons.jsx';

const TONE_VARIANT = {
  primary: 'primary',
  danger: 'danger',
  warning: 'warning',
  warn: 'warning',
  accent: 'primary',
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  tone,
  submitting = false,
  onConfirm,
  onCancel,
  children,
}) {
  if (!open) return null;

  const confirmVariant =
    TONE_VARIANT[tone] || (danger ? 'danger' : 'primary');

  return (
    <div
      className="confirm-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => e.target === e.currentTarget && !submitting && onCancel?.()}
    >
      <div className="confirm-dialog-panel" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h3>
        {message ? <p className="confirm-dialog-message">{message}</p> : null}
        {children}
        <DialogFooter>
          <DialogButton variant="cancel" disabled={submitting} onClick={onCancel}>
            {cancelLabel}
          </DialogButton>
          <DialogButton
            variant={confirmVariant}
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting ? 'Please wait…' : confirmLabel}
          </DialogButton>
        </DialogFooter>
      </div>
    </div>
  );
}
