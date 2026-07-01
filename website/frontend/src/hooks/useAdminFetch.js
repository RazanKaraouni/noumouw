import { useCallback, useEffect, useState } from 'react';
import { useAdminToast } from '../context/AdminToastContext.jsx';
import { getUserFacingError } from '../utils/errorFeedback.js';

/**
 * Fetch admin data with loading state and error toasts.
 * @param {() => Promise<unknown>} fetcher
 * @param {unknown[]} [deps]
 * @param {{ enabled?: boolean, successMessage?: string }} [options]
 */
export function useAdminFetch(fetcher, deps = [], options = {}) {
  const toast = useAdminToast();
  const { enabled = true, successMessage } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      if (successMessage) toast.success(successMessage);
      return result;
    } catch (err) {
      const msg = getUserFacingError(err);
      setError(msg);
      toast.error(msg);
      setData(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [enabled, fetcher, successMessage, toast]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    reload().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, reload };
}
