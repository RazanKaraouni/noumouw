import supabase from '../config/supabase.js';
import { getTherapistId } from '../utils/authContext.js';
import { isUpcomingAppointment } from '../services/appointmentZoomService.js';
import { loadAdminOverviewStats } from '../services/overviewStatsService.js';
import { ERROR_OCCURRED } from '../utils/errorFeedback.js';
import { apiCache } from '../utils/ttlCache.js';

const THERAPIST_OVERVIEW_TTL_MS = 30 * 1000;

export async function getAdminOverview(req, res) {
  try {
    const growthRange = ['30d', '90d', 'all'].includes(req.query.growthRange)
      ? req.query.growthRange
      : '90d';
    const trendGroupBy = req.query.trendGroupBy === 'month' ? 'month' : 'week';
    const payload = await loadAdminOverviewStats(growthRange, trendGroupBy);
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Admin overview error:', err.message);
    return res.status(500).json({ message: ERROR_OCCURRED });
  }
}

export async function getTherapistOverviewStats(req, res) {
  try {
    const therapistId = getTherapistId(req);

    if (!therapistId) {
      return res.status(400).json({ message: 'Therapist identity missing from token.' });
    }

    const payload = await apiCache.getOrSet(
      `therapist:overview:${therapistId}`,
      THERAPIST_OVERVIEW_TTL_MS,
      async () => {
        const [
          pendingAppointments,
          confirmedRows,
          completedSessions,
          linkedChildrenRows,
          pendingAssignments,
          openSlots,
        ] = await Promise.all([
          supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('therapist_id', therapistId)
            .eq('status', 'pending'),
          supabase
            .from('appointments')
            .select('status, appointment_date, availability_id, availability:availability_id(start_time, end_time)')
            .eq('therapist_id', therapistId)
            .eq('status', 'confirmed'),
          supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('therapist_id', therapistId)
            .eq('status', 'completed'),
          supabase
            .from('therapist_children')
            .select('child_id')
            .eq('therapist_id', therapistId),
          supabase
            .from('assignments')
            .select('*', { count: 'exact', head: true })
            .eq('therapist_id', therapistId)
            .eq('status', 'pending'),
          supabase
            .from('availability')
            .select('*', { count: 'exact', head: true })
            .eq('therapist_id', therapistId)
            .eq('is_booked', false)
            .gte('start_time', new Date().toISOString()),
        ]);

        if (pendingAppointments.error) throw pendingAppointments.error;
        if (confirmedRows.error) throw confirmedRows.error;
        if (completedSessions.error) throw completedSessions.error;
        if (linkedChildrenRows.error) throw linkedChildrenRows.error;
        if (pendingAssignments.error) throw pendingAssignments.error;
        if (openSlots.error) throw openSlots.error;

        let confirmedUpcoming = 0;
        for (const row of confirmedRows.data || []) {
          const avail = row.availability || null;
          if (isUpcomingAppointment(row, avail)) confirmedUpcoming += 1;
        }

        const linkedChildren = new Set(
          linkedChildrenRows.data?.map((r) => r.child_id) ?? [],
        ).size;

        return {
          success: true,
          data: {
            linkedChildren,
            pendingAppointments: pendingAppointments.count ?? 0,
            confirmedUpcoming,
            completedSessions: completedSessions.count ?? 0,
            pendingAssignments: pendingAssignments.count ?? 0,
            openSlots: openSlots.count ?? 0,
          },
        };
      },
    );

    return res.status(200).json(payload);
  } catch (err) {
    console.error('Overview stats error:', err.message);
    return res.status(500).json({ message: ERROR_OCCURRED });
  }
}
