import supabase from '../config/supabase.js';
import { canonicalizeActivityDomain } from '../utils/resolveActivityDomain.js';

const ALLOWED_DOMAINS = ['Cognitive', 'Motor', 'Language', 'Social'];

async function loadLatestSavedReport(childId, reportType) {
  const { data, error } = await supabase
    .from('reports')
    .select('report_id, child_id, title, created_at, data_payload')
    .eq('child_id', childId)
    .eq('report_type', reportType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const payload =
    data.data_payload && typeof data.data_payload === 'object'
      ? data.data_payload
      : {};

  return {
    report_id: data.report_id,
    title: data.title,
    saved_at: data.created_at,
    generated_at: payload.generated_at || data.created_at,
    data: payload,
  };
}

function normalizeMilestoneReport(saved) {
  if (!saved) return null;
  const d = saved.data || {};
  const items = Array.isArray(d.milestone_items) ? d.milestone_items : [];
  const byCategory = Array.isArray(d.by_category) ? d.by_category : [];
  const notes = Array.isArray(d.milestone_notes) ? d.milestone_notes : [];

  return {
    report_id: saved.report_id,
    title: saved.title,
    generated_at: saved.generated_at,
    saved_at: saved.saved_at,
    overall_completion_percentage: d.overall_completion_percentage ?? null,
    completed_milestones: d.completed_milestones ?? null,
    total_milestones: d.total_milestones ?? items.length,
    child_age_months: d.child_age_months ?? null,
    by_category: byCategory,
    milestone_items: items,
    milestone_notes: notes,
    overdue_milestones: items.filter(
      (m) => String(m.age_status || '').toLowerCase() === 'overdue',
    ),
  };
}

function normalizeScreeningReport(saved) {
  if (!saved) return null;
  const d = saved.data || {};
  const responses = Array.isArray(d.responses) ? d.responses : [];
  const failedQuestions = Array.isArray(d.failed_questions)
    ? d.failed_questions
    : responses.filter((r) => r.is_fail === true);

  return {
    report_id: saved.report_id,
    title: saved.title,
    generated_at: saved.generated_at,
    saved_at: saved.saved_at,
    score: d.total_score ?? d.score ?? null,
    risk_level: d.risk_level ?? null,
    total_questions: d.total_questions ?? responses.length ?? null,
    failed_questions: failedQuestions,
    responses,
  };
}

export function resolveDomainsNeedingAttention(context) {
  const saved = context?.latest_milestone_report;
  if (saved?.by_category?.length) {
    const fromReport = saved.by_category
      .filter((c) => Number(c.total) > 0)
      .sort(
        (a, b) =>
          Number(a.completion_percentage ?? 100) -
          Number(b.completion_percentage ?? 100),
      )
      .map((c) => canonicalizeActivityDomain(c.category) || c.category)
      .filter((d) => ALLOWED_DOMAINS.includes(d));
    if (fromReport.length) return [...new Set(fromReport)].slice(0, 3);
  }

  return (context?.milestone_report?.focus_domains || [])
    .map((d) => canonicalizeActivityDomain(d) || d)
    .filter((d) => ALLOWED_DOMAINS.includes(d))
    .slice(0, 3);
}

export async function loadLatestGeneratedReports(childId) {
  const [milestoneRaw, screeningRaw] = await Promise.all([
    loadLatestSavedReport(childId, 'milestone_tracking'),
    loadLatestSavedReport(childId, 'screening_summary'),
  ]);

  return {
    milestone_tracking: normalizeMilestoneReport(milestoneRaw),
    screening_summary: normalizeScreeningReport(screeningRaw),
  };
}
