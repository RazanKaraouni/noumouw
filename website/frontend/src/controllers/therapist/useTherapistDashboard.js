import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useState } from 'react';
import { therapistModel } from '../../models/therapistModel.js';

export const INITIAL_STATS_STATE = {
  linkedChildren: 0,
  pendingAppointments: 0,
  confirmedUpcoming: 0,
  completedSessions: 0,
  pendingAssignments: 0,
  openSlots: 0,
};

/** Controller: loads therapist dashboard overview stats (Model → state). */
export function useTherapistDashboard() {
  const [stats, setStats] = useState(INITIAL_STATS_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await therapistModel.dashboard.overview();
      if (res?.success && res.data) {
        setStats(res.data);
      } else if (res?.data) {
        setStats(res.data);
      }
    } catch (err) {
      setError(getUserFacingError(err));
      console.error('Overview fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}
