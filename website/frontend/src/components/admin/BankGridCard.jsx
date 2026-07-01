/**
 * Shared milestone / activity bank grid card shell.
 * Uniform height, clamped title + description; full text via title tooltip and edit modal.
 */
export function BankGrid({ children, className = '' }) {
  return <div className={`admin-bank-grid ${className}`.trim()}>{children}</div>;
}

export default function BankGridCard({
  title,
  badge = null,
  meta = null,
  description = '',
  actions,
}) {
  const desc = String(description || '').trim();

  return (
    <article className="admin-bank-card">
      <div className="admin-bank-card__header">
        <h3 className="admin-bank-card__title line-clamp-2" title={title}>
          {title}
        </h3>
        {badge ? <div className="admin-bank-card__badge-wrap">{badge}</div> : null}
      </div>

      {meta ? <p className="admin-bank-card__meta">{meta}</p> : null}

      <p
        className={`admin-bank-card__description line-clamp-3${desc ? '' : ' admin-bank-card__description--empty'}`}
        title={desc || undefined}
      >
        {desc || '\u00A0'}
      </p>

      {actions ? <div className="admin-bank-card__actions">{actions}</div> : null}
    </article>
  );
}
