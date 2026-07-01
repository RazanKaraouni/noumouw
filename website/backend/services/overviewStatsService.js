import supabase from '../config/supabase.js';
import { apiCache } from '../utils/ttlCache.js';

const PAGE_SIZE = 1000;
const OVERVIEW_CACHE_TTL_MS = 60 * 1000;
const UNASSIGNED_THERAPIST_LABEL = 'Unassigned Provider';
const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'cancellation_requested',
];

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function startDateForGrowth(growthRange) {
  if (growthRange === 'all') return null;
  const days = growthRange === '90d' ? 90 : 30;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

function isoWeekKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function monthKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function weekLabel(weekKey) {
  if (!weekKey) return '—';
  const part = weekKey.split('-W')[1];
  return part ? `Wk ${Number(part)}` : weekKey;
}

function monthLabel(monthKeyStr) {
  if (!monthKeyStr) return '—';
  const [y, m] = monthKeyStr.split('-');
  if (!y || !m) return monthKeyStr;
  try {
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return monthKeyStr;
  }
}

async function countRows(table, filterFn) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filterFn) query = filterFn(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function safeCount(table, filterFn) {
  try {
    return await countRows(table, filterFn);
  } catch (err) {
    console.warn(`[overview] count ${table}:`, err?.message || err);
    return 0;
  }
}

async function fetchPaginated(table, columns, applyFilter) {
  const rows = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from(table)
      .select(columns)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (applyFilter) query = applyFilter(query);
    const { data, error } = await query;
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function safeFetchPaginated(table, columns, applyFilter) {
  try {
    return await fetchPaginated(table, columns, applyFilter);
  } catch (err) {
    console.warn(`[overview] fetch ${table}:`, err?.message || err);
    return [];
  }
}

async function fetchCreatedAtRows(table, columns, sinceIso, applyFilter) {
  const rows = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from(table)
      .select(columns)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (applyFilter) query = applyFilter(query);
    if (sinceIso) query = query.gte('created_at', sinceIso);
    const { data, error } = await query;
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function safeFetchCreatedAtRows(table, columns, sinceIso, applyFilter) {
  try {
    return await fetchCreatedAtRows(table, columns, sinceIso, applyFilter);
  } catch (err) {
    console.warn(`[overview] fetch ${table}:`, err?.message || err);
    return [];
  }
}

function groupRegistrationTrends(parentRows, trendGroupBy) {
  const byPeriod = new Map();
  for (const row of parentRows || []) {
    const key =
      trendGroupBy === 'month' ? monthKey(row.created_at) : isoWeekKey(row.created_at);
    if (!key) continue;
    byPeriod.set(key, (byPeriod.get(key) || 0) + 1);
  }
  return [...byPeriod.entries()]
    .map(([period, count]) => ({
      period,
      label: trendGroupBy === 'month' ? monthLabel(period) : weekLabel(period),
      count,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function groupEngagementTrends(likeRows, saveRows, trendGroupBy) {
  const byPeriod = new Map();

  const ensure = (key) => {
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { period: key, likes: 0, saves: 0 });
    }
    return byPeriod.get(key);
  };

  for (const row of likeRows || []) {
    const key =
      trendGroupBy === 'month' ? monthKey(row.created_at) : isoWeekKey(row.created_at);
    if (!key) continue;
    ensure(key).likes += 1;
  }

  for (const row of saveRows || []) {
    const key =
      trendGroupBy === 'month' ? monthKey(row.created_at) : isoWeekKey(row.created_at);
    if (!key) continue;
    ensure(key).saves += 1;
  }

  return [...byPeriod.values()]
    .map((row) => ({
      period: row.period,
      label: trendGroupBy === 'month' ? monthLabel(row.period) : weekLabel(row.period),
      likes: row.likes,
      saves: row.saves,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function normalizeTherapistDisplayName(rawName) {
  const name = String(rawName ?? '').trim();
  if (
    !name ||
    /^unknown$/i.test(name) ||
    /^unassigned$/i.test(name) ||
    /^n\/a$/i.test(name) ||
    /^general system$/i.test(name)
  ) {
    return UNASSIGNED_THERAPIST_LABEL;
  }
  return name;
}

function therapistChartLabelFromId(therapistId, nameById, unassignedKey) {
  if (!therapistId || therapistId === unassignedKey) {
    return UNASSIGNED_THERAPIST_LABEL;
  }
  return normalizeTherapistDisplayName(nameById.get(therapistId));
}

async function countAppointmentsByStatus() {
  const counts = await Promise.all(
    APPOINTMENT_STATUSES.map(async (status) => {
      const count = await safeCount('appointments', (q) => q.eq('status', status));
      return [status, count];
    }),
  );
  return APPOINTMENT_STATUSES.map((status) => ({
    status,
    label: status.replace(/_/g, ' '),
    count: counts.find(([s]) => s === status)?.[1] || 0,
  })).filter((x) => x.count > 0 || APPOINTMENT_STATUSES.includes(x.status));
}

function buildTherapistSessionCounts(appointmentRows, therapists) {
  const UNASSIGNED_KEY = '__unassigned__';
  const byTherapist = new Map();
  for (const row of appointmentRows || []) {
    const key = row.therapist_id || UNASSIGNED_KEY;
    byTherapist.set(key, (byTherapist.get(key) || 0) + 1);
  }
  const nameById = new Map(
    (therapists || []).map((t) => [
      t.therapist_id,
      normalizeTherapistDisplayName(t.full_name),
    ]),
  );
  return [...byTherapist.entries()]
    .map(([therapistId, sessions]) => ({
      therapistId: therapistId === UNASSIGNED_KEY ? null : therapistId,
      fullName: therapistChartLabelFromId(therapistId, nameById, UNASSIGNED_KEY),
      sessions,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 12);
}

/** Meetings launched via Zoom (`appointments.is_started = true`). */
function aggregateStartedMeetingsByStatus(rows) {
  const counts = Object.create(null);
  for (const row of rows || []) {
    if (row.is_started !== true) continue;
    const s = String(row.status || 'unknown').toLowerCase().trim();
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([status, count]) => ({
      status,
      label: status.replace(/_/g, ' '),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildTherapistMeetingCounts(startedRows, therapists) {
  const UNASSIGNED_KEY = '__unassigned__';
  const byTherapist = new Map();
  for (const row of startedRows || []) {
    if (row.is_started !== true) continue;
    const key = row.therapist_id || UNASSIGNED_KEY;
    byTherapist.set(key, (byTherapist.get(key) || 0) + 1);
  }
  const nameById = new Map(
    (therapists || []).map((t) => [
      t.therapist_id,
      normalizeTherapistDisplayName(t.full_name),
    ]),
  );
  return [...byTherapist.entries()]
    .map(([therapistId, meetings]) => ({
      therapistId: therapistId === UNASSIGNED_KEY ? null : therapistId,
      fullName: therapistChartLabelFromId(therapistId, nameById, UNASSIGNED_KEY),
      meetings,
    }))
    .sort((a, b) => b.meetings - a.meetings)
    .slice(0, 12);
}

function buildResourceEngagement(likeRows, saveRows, trendGroupBy) {
  let totalLikes = 0;
  let totalSaves = 0;
  for (const row of likeRows || []) totalLikes += 1;
  for (const row of saveRows || []) totalSaves += 1;

  return {
    totalLikes,
    totalSaves,
    trends: groupEngagementTrends(likeRows, saveRows, trendGroupBy),
  };
}

async function listPendingFlaggedReports() {
  const { data, error } = await supabase
    .from('resource_reports')
    .select(
      'report_id, reporter_id, target_type, resource_id, post_id, comment_id, reason, status, created_at, updated_at',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Full overview payload for admin dashboard (service-role Supabase).
 * @param {string} growthRange - '30d' | '90d' | 'all'
 * @param {string} trendGroupBy - 'week' | 'month'
 */
export async function loadAdminOverviewStats(growthRange = '90d', trendGroupBy = 'week') {
  const cacheKey = `admin:overview:${growthRange}:${trendGroupBy}`;
  return apiCache.getOrSet(cacheKey, OVERVIEW_CACHE_TTL_MS, () =>
    loadAdminOverviewStatsUncached(growthRange, trendGroupBy),
  );
}

async function loadAdminOverviewStatsUncached(growthRange = '90d', trendGroupBy = 'week') {
  const growthStart = startDateForGrowth(growthRange);
  const growthSinceIso = growthStart ? growthStart.toISOString() : null;
  const groupBy = trendGroupBy === 'month' ? 'month' : 'week';

  const [
    totalParents,
    totalChildren,
    totalTherapists,
    flaggedItems,
    screeningsCount,
    parentTrendRows,
    appointmentsByStatus,
    utilizationAppointmentRows,
    therapistDirectoryRes,
    assignmentsCompleted,
    assignmentsTotal,
    likeRows,
    saveRows,
    flaggedReports,
    activeZoomMeetings,
    totalMeetingsLaunched,
    startedMeetingRows,
  ] = await Promise.all([
    safeCount('parents'),
    safeCount('children'),
    safeCount('therapists'),
    safeCount('resource_reports', (q) => q.eq('status', 'pending')),
    safeCount('screening_results'),
    safeFetchCreatedAtRows('parents', 'created_at', growthSinceIso),
    countAppointmentsByStatus(),
    safeFetchPaginated('appointments', 'therapist_id, status', (q) =>
      q.in('status', ['confirmed', 'completed']),
    ),
    supabase.from('therapists').select('therapist_id, full_name'),
    safeCount('assignments', (q) => q.eq('status', 'completed')),
    safeCount('assignments'),
    safeFetchCreatedAtRows('resource_likes', 'created_at', growthSinceIso),
    safeFetchCreatedAtRows('resource_saves', 'created_at', growthSinceIso),
    listPendingFlaggedReports().catch((err) => {
      console.warn('[overview] flagged reports:', err?.message || err);
      return [];
    }),
    safeCount('appointments', (q) => q.eq('is_started', true).eq('status', 'confirmed')),
    safeCount('appointments', (q) => q.eq('is_started', true)),
    safeFetchPaginated('appointments', 'therapist_id, status, is_started', (q) =>
      q.eq('is_started', true),
    ),
  ]);

  if (therapistDirectoryRes.error) {
    console.warn('[overview] therapist directory:', therapistDirectoryRes.error.message);
  }

  const therapistDirectory = therapistDirectoryRes.data || [];
  const registrationTrends = groupRegistrationTrends(parentTrendRows, groupBy);
  const therapistUtilization = buildTherapistSessionCounts(
    utilizationAppointmentRows,
    therapistDirectory,
  );

  const assignmentRate =
    assignmentsTotal > 0
      ? clampPct((assignmentsCompleted / assignmentsTotal) * 100)
      : 0;

  const screeningRate =
    totalChildren > 0 ? clampPct((screeningsCount / totalChildren) * 100) : 0;

  const resourceEngagement = buildResourceEngagement(likeRows, saveRows, groupBy);

  const telehealthUsage = {
    totalMeetingsLaunched,
    meetingsByStatus: aggregateStartedMeetingsByStatus(startedMeetingRows),
    meetingsByTherapist: buildTherapistMeetingCounts(
      startedMeetingRows,
      therapistDirectory,
    ),
  };

  return {
    stats: {
      totalParents,
      totalChildren,
      totalTherapists,
      totalUsers: totalParents,
      flaggedItems,
      registrationTrends,
      registrationGroupBy: groupBy,
      screeningFunnel: {
        childrenTotal: totalChildren,
        screeningsTotal: screeningsCount,
        ratePct: screeningRate,
      },
      appointmentsByStatus,
      therapistUtilization,
      assignmentCompletion: {
        completed: assignmentsCompleted,
        total: assignmentsTotal,
        ratePct: assignmentRate,
      },
      resourceEngagement,
      activeZoomMeetings,
      telehealthUsage,
    },
    flaggedReports,
  };
}
