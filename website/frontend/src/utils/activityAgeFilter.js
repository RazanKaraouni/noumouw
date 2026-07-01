import { childAgeInTier } from './milestoneAgeTier.js';

export function activityMatchesChildAge(activity, childAgeMonths) {
  if (!Number.isFinite(childAgeMonths)) return true;
  const age = Math.floor(childAgeMonths);
  const min = activity?.min_age_months;
  const max = activity?.max_age_months;
  if (min == null && max == null) return true;
  if (min == null || max == null) return true;
  return childAgeInTier(age, min, max);
}

export function filterActivitiesByChildAge(activities, childAgeMonths) {
  const list = Array.isArray(activities) ? activities : [];
  if (!Number.isFinite(childAgeMonths)) return list;
  return list.filter((a) => activityMatchesChildAge(a, childAgeMonths));
}
