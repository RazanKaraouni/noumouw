import { NavLink } from 'react-router-dom';

export default function SidebarNavItem({
  to,
  label,
  icon: Icon,
  badge = 0,
  trailing = null,
  ariaLabel,
  onNavigate,
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sidebar-nav-item${isActive ? ' is-active' : ''}`}
      aria-label={ariaLabel}
      onClick={onNavigate}
    >
      <span className="sidebar-nav-item__icon" aria-hidden>
        {Icon ? <Icon size={18} strokeWidth={2} /> : null}
        {trailing}
      </span>
      <span className="sidebar-nav-item__label">{label}</span>
      {badge > 0 ? (
        <span className="sidebar-nav-item__badge" aria-label={`${badge} pending`}>
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}
