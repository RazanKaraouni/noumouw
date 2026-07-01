export default function AdminPagination({
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
}) {
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-[var(--muted)]">
      <span>
        Showing {rangeStart}–{rangeEnd} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] disabled:opacity-40 hover:enabled:opacity-90"
        >
          Previous
        </button>
        <span className="tabular-nums px-2">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] disabled:opacity-40 hover:enabled:opacity-90"
        >
          Next
        </button>
      </div>
    </div>
  );
}
