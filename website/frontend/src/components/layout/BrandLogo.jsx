import { Link } from 'react-router-dom';

export default function BrandLogo({ subtitle, to, compact = false }) {
  const content = (
    <div className={`brand-logo${compact ? ' brand-logo--compact' : ''}`}>
      <span className="brand-logo__name">Noumouw</span>
      {subtitle ? <span className="brand-logo__subtitle">{subtitle}</span> : null}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="brand-logo-link">
        {content}
      </Link>
    );
  }

  return content;
}
