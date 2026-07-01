import { useTheme } from '../../context/ThemeContext.jsx';

export default function ThemeSettingRow() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="theme-setting-row">
      <div className="theme-setting-copy">
        <div className="theme-setting-title">Dark mode</div>
        <p className="theme-setting-desc">
          {isDark ? 'Dark theme is on. Switch to light mode for a white background.' : 'Light theme is on. Switch to dark mode for the default console look.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`theme-switch${isDark ? ' theme-switch--on' : ''}`}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        <span className="theme-switch-knob" aria-hidden />
      </button>
    </div>
  );
}
