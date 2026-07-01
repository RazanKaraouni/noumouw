import { NavLink } from 'react-router-dom';

const linkStyle = ({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  padding: '9px 12px',
  marginBottom: 10,
  borderRadius: 8,
  border: `1px solid ${isActive ? 'var(--green)' : 'var(--border)'}`,
  background: isActive ? 'rgba(var(--green-rgb), 0.1)' : 'transparent',
  color: isActive ? 'var(--green)' : 'var(--text)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'var(--font)',
  textDecoration: 'none',
  transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease',
});

export default function SidebarSettingsButton() {
  return (
    <NavLink to="/settings" style={linkStyle}>
      <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
        ⚙
      </span>
      Settings
    </NavLink>
  );
}
