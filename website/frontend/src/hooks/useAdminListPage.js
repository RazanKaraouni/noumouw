import { useCallback, useEffect, useState } from 'react';
import { useAdminToast } from '../context/AdminToastContext.jsx';
import { useAdminTable } from './useAdminTable.js';
import { getUserFacingError } from '../utils/errorFeedback.js';

/**
 * Load a list for admin tables with toast errors, optional client search/filter, pagination.
 * @param {() => Promise<{ data?: unknown } | unknown[]>} fetcher
 * @param {unknown[]} deps
 * @param {{ tableOptions?: object, errorMessage?: string }} [config]
 */
export function useAdminListPage(fetcher, deps = [], config = {}) {
  const toast = useAdminToast();
  const { tableOptions = {}, errorMessage = 'Failed to load data.' } = config;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetcher();
      const data = Array.isArray(result)
        ? result
        : result?.data?.rows ?? result?.data ?? result?.rows ?? [];
      setRows(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      setRows([]);
      toast.error(getUserFacingError(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetcher, errorMessage, toast]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const table = useAdminTable(rows, tableOptions);

  return { rows, setRows, loading, reload, table, toast };
}
