import { useCallback, useEffect, useState } from 'react';
import { useAdminToast } from '../context/AdminToastContext.jsx';
import { adminModel } from '../models/adminModel.js';
import { getUserFacingError } from '../utils/errorFeedback.js';

const POLL_MS = 45000;

export function useOverviewStats(growthRange = '90d', trendGroupBy = 'week') {
  const toast = useAdminToast();
  const [stats, setStats] = useState(null);
  const [flaggedReports, setFlaggedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const { data } = await adminModel.overview(growthRange, trendGroupBy);
      setStats(data.stats);
      setFlaggedReports(data.flaggedReports || []);
    } catch (apiErr) {
      const msg = getUserFacingError(apiErr);
      setError(msg);
      if (!silent) {
        setStats(null);
        toast.error(msg);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [growthRange, trendGroupBy, toast]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const timer = window.setInterval(() => refetch({ silent: true }), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refetch]);

  return {
    stats,
    flaggedReports,
    loading,
    error,
    refetch,
  };
}

