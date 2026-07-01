import supabase from '../config/supabase.js';
import { ageMonthsFromDateOfBirth } from '../utils/childAge.js';
import { tierForChildAge, rowMatchesTier } from '../utils/cdcMilestoneAgeTiers.js';

function milestoneMatchKey(title, category, targetAgeMonths) {
  return [
    String(title ?? '').trim().toLowerCase(),
    String(category ?? '').trim().toLowerCase(),
    String(targetAgeMonths ?? ''),
  ].join('\0');
}

function pickLatestProgressRow(rows) {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => {
    const aT = new Date(a.created_at || 0).getTime();
    const bT = new Date(b.created_at || 0).getTime();
    return bT - aT;
  })[0];
}

/**
 * Age-appropriate milestones for the child (same filter as parent TrackMilestonesPage),
 * merged with latest child_milestones progress per milestone.
 */
export async function loadMergedMilestonesForChild(childId, dateOfBirth) {
  const ageMonths = ageMonthsFromDateOfBirth(dateOfBirth) ?? 0;
  const tier = tierForChildAge(ageMonths);

  const catalogQuery = supabase
    .from('milestones')
    .select(
      'milestones_id, title, description, domain, age_months_min, age_months_max',
    )
    .order('age_months_min', { ascending: true });

  const [catalogRes, progressRes] = await Promise.all([
    catalogQuery,
    supabase
      .from('child_milestones')
      .select(
        'child_milestones_id, milestone_title, milestone_category, target_age_months, is_completed, completion_date, notes, created_at',
      )
      .eq('child_id', childId)
      .order('created_at', { ascending: false }),
  ]);

  if (catalogRes.error) throw catalogRes.error;
  if (progressRes.error) throw progressRes.error;

  const progressByKey = new Map();
  for (const row of progressRes.data || []) {
    const key = milestoneMatchKey(
      row.milestone_title,
      row.milestone_category,
      row.target_age_months,
    );
    if (!progressByKey.has(key)) {
      progressByKey.set(key, []);
    }
    progressByKey.get(key).push(row);
  }

  const catalogRows = tier
    ? (catalogRes.data || []).filter((m) => rowMatchesTier(m, tier))
    : catalogRes.data || [];

  const merged = catalogRows.map((m) => {
    const title = m.title ?? '';
    const category = m.domain ?? 'general';
    const targetAgeMonths = m.age_months_max ?? 0;
    const key = milestoneMatchKey(title, category, targetAgeMonths);
    const matched = pickLatestProgressRow(progressByKey.get(key));

    return {
      milestones_id: m.milestones_id,
      milestone_title: title,
      milestone_category: category,
      target_age_months: targetAgeMonths,
      age_months_min: m.age_months_min,
      age_months_max: m.age_months_max,
      description: m.description ?? null,
      child_milestones_id: matched?.child_milestones_id ?? null,
      is_completed: matched?.is_completed === true,
      completion_date: matched?.completion_date ?? null,
      notes: matched?.notes ?? null,
      created_at: matched?.created_at ?? null,
    };
  });

  return { milestones: merged, ageMonths };
}
