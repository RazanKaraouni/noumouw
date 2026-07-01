/**
 * Therapist portal view primitives (presentation only — no API calls).
 */
import { createPortal } from 'react-dom';

export function formatDate(raw) {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export function riskBadgeTone(risk) {
  const r = String(risk || '').toLowerCase();
  if (r.includes('high')) return 'danger';
  if (r.includes('moderate') || r.includes('medium')) return 'warning';
  if (r.includes('low')) return 'success';
  return 'default';
}

export function Btn({ variant = 'primary', className = '', style, children, ...props }) {
  const variantClass =
    variant === 'ghost'
      ? 'td-btn-ghost'
      : variant === 'danger'
        ? 'td-btn-danger'
        : variant === 'accent'
          ? 'td-btn-accent'
          : 'td-btn-primary';
  return (
    <button type="button" className={`td-btn ${variantClass} ${className}`.trim()} style={style} {...props}>
      {children}
    </button>
  );
}

export function Badge({ tone = 'default', children }) {
  const toneClass = ['default', 'success', 'warning', 'danger', 'info'].includes(tone)
    ? `td-badge-${tone}`
    : 'td-badge-default';
  return <span className={`td-badge ${toneClass}`}>{children}</span>;
}

export function Skeleton({ style, className = '' }) {
  return <div className={`td-skeleton ${className}`.trim()} style={style} aria-hidden />;
}

export function GlassCard({ children, style, className = '', onClick, ...props }) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      className={`dashboard-panel td-glass ${interactive ? 'td-glass-interactive' : ''} ${className}`.trim()}
      style={style}
      onClick={onClick}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <header className="dashboard-page-header">
      <div>
        <h1 className="dashboard-page-header__title">{title}</h1>
        {subtitle && <p className="dashboard-page-header__desc">{subtitle}</p>}
      </div>
      {action ? <div className="td-page-actions">{action}</div> : null}
    </header>
  );
}

export function Section({ title, children, action }) {
  return (
    <section className="td-section">
      <div className="td-section-head">
        <h2 className="dashboard-section-label" style={{ marginBottom: 0 }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, description, message, action }) {
  const desc = description || message;
  return (
    <div className="td-empty">
      {icon && <div className="td-empty-icon" aria-hidden>{icon}</div>}
      {title && <div className="td-empty-title">{title}</div>}
      {desc && <p className="td-empty-desc">{desc}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, title, onClose, footer, children }) {
  if (!open) return null;

  return createPortal(
    <div
      className="td-modal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="td-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="td-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="td-modal-title" className="td-modal-title">
          {title}
        </h2>
        <div className="td-modal-body">{children}</div>
        {footer ? <div className="td-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function DateSortSelect({ value, onChange, id = 'td-date-sort' }) {
  return (
    <select
      id={id}
      className="td-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 'auto', minWidth: 150 }}
    >
      <option value="desc">Newest date first</option>
      <option value="asc">Oldest date first</option>
    </select>
  );
}
