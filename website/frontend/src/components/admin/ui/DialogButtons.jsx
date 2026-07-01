export function DialogFooter({ children, className = '' }) {
  return <div className={`admin-dialog-footer ${className}`.trim()}>{children}</div>;
}

export function DialogButton({
  variant = 'cancel',
  type = 'button',
  disabled = false,
  onClick,
  children,
  className = '',
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`admin-dialog-btn admin-dialog-btn--${variant} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
