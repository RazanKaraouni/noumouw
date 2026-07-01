export default function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="admin-data-table-wrap">
      <div className="h-11 bg-[var(--surface2)] border-b border-[var(--border)] animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-4 py-3 border-b border-[var(--border)] last:border-0"
        >
          {Array.from({ length: cols }).map((__, j) => (
            <div
              key={j}
              className="h-4 flex-1 rounded bg-[var(--surface2)] animate-pulse"
              style={{ maxWidth: j === 0 ? '28%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-xl noumouw-card border-0 animate-pulse"
        />
      ))}
    </div>
  );
}
