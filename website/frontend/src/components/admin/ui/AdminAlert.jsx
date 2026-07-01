export default function AdminAlert({ variant = 'error', children, className = '' }) {
  if (!children) return null;

  return (
    <div
      className={`admin-alert admin-alert--${variant} ${className}`.trim()}
      role="alert"
    >
      {children}
    </div>
  );
}
