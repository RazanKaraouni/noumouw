export default function AdminModal({
  title,
  children,
  onClose,
  size = 'md',
  titleId,
  closeOnBackdrop = true,
  compact = false,
}) {
  const panelSizeClass =
    size === 'wide'
      ? 'confirm-dialog-panel--wide'
      : size === 'xl'
        ? 'confirm-dialog-panel--xl'
        : size === 'lg'
          ? 'confirm-dialog-panel--lg'
          : '';

  return (
    <div
      className="confirm-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId || 'admin-modal-title'}
      onClick={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={`confirm-dialog-panel ${panelSizeClass}${compact ? ' confirm-dialog-panel--compact' : ''} max-h-[90vh] overflow-y-auto`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-header">
          <h2 id={titleId || 'admin-modal-title'} className="confirm-dialog-title">
            {title}
          </h2>
          {onClose ? (
            <button
              type="button"
              className="confirm-dialog-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="confirm-dialog-body">{children}</div>
      </div>
    </div>
  );
}
