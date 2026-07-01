/** Activity is appropriate when the child's age (months) falls within the band. */
export function activityMatchesChildAge(activity, childAgeMonths) {
  if (!Number.isFinite(childAgeMonths)) return true;
  const age = Math.floor(childAgeMonths);
  const min = activity?.min_age_months;
  const max = activity?.max_age_months;
  if (min == null && max == null) return true;
  if (min == null || max == null) return true;
  return Number(min) <= age && Number(max) >= age;
}

export function filterActivitiesByChildAge(activities, childAgeMonths) {
  const list = Array.isArray(activities) ? activities : [];
  if (!Number.isFinite(childAgeMonths)) return list;
  return list.filter((a) => activityMatchesChildAge(a, childAgeMonths));
}
