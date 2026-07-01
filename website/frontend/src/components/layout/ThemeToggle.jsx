import { useTheme } from '../../context/ThemeContext.jsx';

export default function ThemeToggle({ compact = false, className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {isDark ? '☀' : '☾'}
      </span>
      {!compact && (
        <span className="theme-toggle-label">{isDark ? 'Light mode' : 'Dark mode'}</span>
      )}
    </button>
  );
}
