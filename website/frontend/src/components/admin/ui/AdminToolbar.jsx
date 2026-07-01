export default function AdminToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = null,
  actions = null,
}) {
  return (
    <div className="admin-toolbar">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="admin-toolbar-search"
        aria-label="Search table"
      />
      {filters && <div className="admin-toolbar-filters">{filters}</div>}
      {actions && <div className="admin-toolbar-actions">{actions}</div>}
    </div>
  );
}

export function AdminSelect({ value, onChange, children, className = '', 'aria-label': ariaLabel }) {
  return (
    <select
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      className={`admin-select ${className}`.trim()}
    >
      {children}
    </select>
  );
}
