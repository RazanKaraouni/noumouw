export const ADMIN_PAGE_SIZE = 20;

/**
 * @param {unknown[]} rows
 * @param {string} search
 * @param {(row: unknown, q: string) => boolean} [matcher]
 */
export function filterBySearch(rows, search, matcher) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    if (matcher) return matcher(row, q);
    const blob = JSON.stringify(row).toLowerCase();
    return blob.includes(q);
  });
}

/**
 * @param {unknown[]} rows
 * @param {number} page 1-based
 * @param {number} [pageSize]
 */
export function paginateRows(rows, page, pageSize = ADMIN_PAGE_SIZE) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
    pageSize,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, total),
  };
}
