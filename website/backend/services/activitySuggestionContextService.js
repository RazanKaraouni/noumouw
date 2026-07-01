import supabase from '../config/supabase.js';
import { ageMonthsFromDateOfBirth } from '../utils/childAge.js';
import { loadLatestScreeningRiskForChildIds } from './screeningResultsService.js';

function toBoolean(value) {
  return value === true || value === 'true' || value === 1;
}

function isOverdueMilestone(row, ageMonths) {
  if (toBoolean(row.is_completed)) return false;
  const target = Number(row.target_age_months ?? 0);
  return target <= ageMonths;
}

export async function assertParentOwnsChild(parentUserId, childId) {
  const { data, error } = await supabase
    .from('children')
    .select('children_id, full_name, date_of_birth, parent_id')
    .eq('children_id', childId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error('Child not found.');
    err.status = 404;
    throw err;
  }
  if (String(data.parent_id) !== String(parentUserId)) {
    const err = new Error('You do not have access to this child.');
    err.status = 403;
    throw err;
  }
  return data;
}

/**
 * Gather child context for activity suggestions.
 */
export async function loadActivitySuggestionContext(parentUserId, childId) {
  const child = await assertParentOwnsChild(parentUserId, childId);
  const ageMonths = ageMonthsFromDateOfBirth(child.date_of_birth) ?? 0;

  const [milestonesRes, assignmentsRes, screeningRows] = await Promise.all([
    supabase
      .from('child_milestones')
      .select(
        'milestone_title, milestone_category, target_age_months, is_completed, completion_date',
      )
      .eq('child_id', child.children_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('assignments')
      .select('title, domain, status, priority')
      .eq('child_id', child.children_id)
      .in('status', ['pending', 'incomplete'])
      .order('created_at', { ascending: false }),
    loadLatestScreeningRiskForChildIds([child.children_id]),
  ]);

  if (milestonesRes.error) throw milestonesRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;

  const overdueMilestones = (milestonesRes.data || [])
    .filter((row) => isOverdueMilestone(row, ageMonths))
    .map((row) => ({
      title: row.milestone_title ?? 'Untitled',
      milestone_category: row.milestone_category ?? 'Uncategorized',
      target_age_months: Number(row.target_age_months ?? 0),
    }));

  const pendingAssignments = (assignmentsRes.data || []).map((row) => ({
    title: row.title ?? 'Untitled',
    domain: row.domain ?? null,
    status: row.status,
    priority: row.priority ?? null,
  }));

  const latestScreening = (screeningRows || []).find(
    (r) => Number(r.child_id) === Number(child.children_id),
  );

  const overdueByDomain = {};
  for (const m of overdueMilestones) {
    const cat = String(m.milestone_category || 'Uncategorized');
    overdueByDomain[cat] = (overdueByDomain[cat] || 0) + 1;
  }

  return {
    child: {
      children_id: child.children_id,
      full_name: child.full_name,
      date_of_birth: child.date_of_birth,
    },
    ageMonths,
    overdueMilestones,
    pendingAssignments,
    latestRiskLevel: latestScreening?.risk_level ?? null,
    overdueByDomain,
  };
}
