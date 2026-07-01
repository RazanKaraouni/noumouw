import { useMemo, useState } from 'react';
import {
  ADMIN_PAGE_SIZE,
  filterBySearch,
  paginateRows,
} from '../utils/adminTableUtils.js';

/**
 * Client-side search, filter, and pagination for admin tables.
 * @param {unknown[]} sourceRows
 * @param {{ search?: string, filterFn?: (row: unknown) => boolean, searchFn?: (row: unknown, q: string) => boolean, pageSize?: number }} options
 */
export function useAdminTable(sourceRows, options = {}) {
  const {
    search: initialSearch = '',
    filterFn,
    searchFn,
    pageSize = ADMIN_PAGE_SIZE,
  } = options;

  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = Array.isArray(sourceRows) ? sourceRows : [];
    if (filterFn) rows = rows.filter(filterFn);
    return filterBySearch(rows, search, searchFn);
  }, [sourceRows, filterFn, search, searchFn]);

  const pagination = useMemo(
    () => paginateRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const setSearchAndReset = (value) => {
    setSearch(value);
    setPage(1);
  };

  const setFilterReset = () => setPage(1);

  return {
    search,
    setSearch: setSearchAndReset,
    page,
    setPage,
    filtered,
    ...pagination,
    setFilterReset,
  };
}
