import supabase from '../config/supabase.js';
import { ageMonthsFromDateOfBirth } from '../utils/childAge.js';
import { loadMergedMilestonesForChild } from './childMilestoneProgressService.js';
import { loadScreeningResultsForChildId } from './screeningResultsService.js';
import { assertParentOwnsChild } from './activitySuggestionContextService.js';
import { getAllActivities } from '../models/activityModel.js';
import { loadLatestGeneratedReports } from './lastGeneratedReportsService.js';
import { apiCache } from '../utils/ttlCache.js';

const ASSISTANT_CONTEXT_TTL_MS = 2 * 60 * 1000;

const DEFAULT_CATEGORIES = ['Cognitive', 'Motor', 'Language', 'Social'];

async function loadAssignmentsWithTherapists(childId) {
  const { data, error } = await supabase
    .from('assignments')
    .select(
      'assignment_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at, therapist_id',
    )
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) throw error;

  const therapistIds = [
    ...new Set((data || []).map((a) => a.therapist_id).filter(Boolean)),
  ];
  let nameByTherapist = new Map();
  if (therapistIds.length) {
    const therapists = await supabase
      .from('therapists')
      .select('therapist_id, full_name, profession')
      .in('therapist_id', therapistIds);
    if (!therapists.error) {
      nameByTherapist = new Map(
        (therapists.data || []).map((t) => [
          t.therapist_id,
          { name: t.full_name, profession: t.profession || null },
        ]),
      );
    }
  }

  return (data || []).map((row) => {
    const therapist = nameByTherapist.get(row.therapist_id);
    return {
      assignment_id: row.assignment_id,
      title: row.title,
      description: row.description,
      domain: row.domain,
      status: row.status,
      parent_notes: row.parent_notes,
      therapist_reply: row.therapist_reply,
      due_date: row.due_date,
      priority: row.priority,
      created_at: row.created_at,
      therapist_name: therapist?.name || 'Therapist',
      therapist_profession: therapist?.profession || null,
    };
  });
}

/** Suggest speech vs psychomotor focus from milestone domain gaps (informational only). */
function deriveTherapyHints(categoryBreakdown, focusDomains) {
  const scores = { speech: 0, psychomotor: 0 };
  const domainToTherapy = {
    Language: 'speech',
    Motor: 'psychomotor',
    Cognitive: 'psychomotor',
    Social: 'speech',
  };

  for (const domain of focusDomains || []) {
    const stats = categoryBreakdown?.[domain];
    if (!stats?.total) continue;
    const weight = stats.overdue * 3 + (100 - stats.completion_rate);
    const therapy = domainToTherapy[domain];
    if (therapy === 'speech') scores.speech += weight;
    if (therapy === 'psychomotor') scores.psychomotor += weight;
  }

  let suggested = 'Discuss with your pediatrician or a Noumouw therapist';
  if (scores.speech > scores.psychomotor) suggested = 'Speech Therapy';
  else if (scores.psychomotor > scores.speech) suggested = 'Psychomotor Therapy';
  else if (scores.speech > 0 && scores.psychomotor > 0) suggested = 'Speech Therapy and Psychomotor Therapy';

  return {
    speech_priority_score: Number(scores.speech.toFixed(1)),
    psychomotor_priority_score: Number(scores.psychomotor.toFixed(1)),
    suggested_therapy_focus: suggested,
    rationale_domains: focusDomains || [],
  };
}

function buildMilestoneTrackingReport(milestones, ageMonths) {
  const rows = (milestones || []).map((m) => {
    const target = Number(m.target_age_months ?? 0);
    const completed = m.is_completed === true;
    let status = 'Completed';
    if (!completed) {
      status = target > ageMonths ? 'Upcoming' : 'Overdue';
    }
    return {
      title: m.milestone_title,
      domain: m.milestone_category,
      target_age_months: target,
      status,
      is_completed: completed,
      notes: m.notes ?? null,
    };
  });

  const categoryBreakdown = {};
  for (const cat of DEFAULT_CATEGORIES) {
    categoryBreakdown[cat] = { total: 0, completed: 0, overdue: 0, upcoming: 0 };
  }

  for (const row of rows) {
    const key = row.domain || 'Uncategorized';
    if (!categoryBreakdown[key]) {
      categoryBreakdown[key] = { total: 0, completed: 0, overdue: 0, upcoming: 0 };
    }
    categoryBreakdown[key].total += 1;
    if (row.is_completed) categoryBreakdown[key].completed += 1;
    else if (row.status === 'Overdue') categoryBreakdown[key].overdue += 1;
    else categoryBreakdown[key].upcoming += 1;
  }

  for (const key of Object.keys(categoryBreakdown)) {
    const c = categoryBreakdown[key];
    c.completion_rate =
      c.total === 0 ? 0 : Number(((c.completed / c.total) * 100).toFixed(1));
  }

  const focusDomains = Object.entries(categoryBreakdown)
    .filter(([, s]) => s.total > 0)
    .map(([domain, s]) => ({
      domain,
      overdue: s.overdue,
      completion_rate: s.completion_rate,
      priority_score: s.overdue * 3 + (100 - s.completion_rate),
    }))
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 4)
    .map((x) => x.domain);

  const total = rows.length;
  const completed = rows.filter((r) => r.is_completed).length;

  return {
    milestones: rows,
    category_breakdown: categoryBreakdown,
    focus_domains: focusDomains,
    completion_rate: total === 0 ? 0 : Number(((completed / total) * 100).toFixed(1)),
    overdue_count: rows.filter((r) => r.status === 'Overdue').length,
  };
}

/**
 * Full child context for the parent AI assistant chat.
 */
export async function loadFullAssistantContext(parentUserId, childId) {
  const cacheKey = `assistant:context:${parentUserId}:${childId}`;
  return apiCache.getOrSet(cacheKey, ASSISTANT_CONTEXT_TTL_MS, () =>
    loadFullAssistantContextUncached(parentUserId, childId),
  );
}

async function loadFullAssistantContextUncached(parentUserId, childId) {
  const child = await assertParentOwnsChild(parentUserId, childId);
  const ageMonths = ageMonthsFromDateOfBirth(child.date_of_birth) ?? 0;

  const [
    milestoneBundle,
    assignments,
    screeningRows,
    referenceActivities,
    generatedReports,
  ] = await Promise.all([
    loadMergedMilestonesForChild(child.children_id, child.date_of_birth),
    loadAssignmentsWithTherapists(child.children_id),
    loadScreeningResultsForChildId(child.children_id),
    getAllActivities({ childAgeMonths: ageMonths }),
    loadLatestGeneratedReports(child.children_id),
  ]);

  const milestoneReport = buildMilestoneTrackingReport(
    milestoneBundle.milestones,
    ageMonths,
  );

  const therapyHints = deriveTherapyHints(
    milestoneReport.category_breakdown,
    milestoneReport.focus_domains,
  );

  const latestScreening = screeningRows?.[0] ?? null;

  return {
    child: {
      children_id: child.children_id,
      full_name: child.full_name,
      date_of_birth: child.date_of_birth,
      age_months: ageMonths,
    },
    milestone_report: milestoneReport,
    therapy_hints: therapyHints,
    latest_screening: latestScreening
      ? {
          risk_level: latestScreening.risk_level,
          score: latestScreening.score,
          created_at: latestScreening.created_at,
          total_questions: latestScreening.total_questions,
        }
      : null,
    latest_milestone_report: generatedReports.milestone_tracking,
    latest_screening_report: generatedReports.screening_summary,
    assignments,
    newest_assignment: assignments[0] ?? null,
    reference_activities: (referenceActivities || []).slice(0, 12).map((a) => ({
      title: a.title,
      domain: a.domain,
      instructions: a.instructions || null,
      min_age_months: a.min_age_months,
      max_age_months: a.max_age_months,
    })),
  };
}
