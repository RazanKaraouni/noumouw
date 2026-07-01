/** Child age in whole months from date_of_birth (YYYY-MM-DD or ISO). */
export function ageMonthsFromDateOfBirth(rawDob) {
  if (!rawDob) return null;
  const dob = new Date(rawDob);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) months = 0;
  return months;
}

export function resolveChildAgeMonths(childOrDob, explicitMonths) {
  if (Number.isFinite(explicitMonths)) return Math.floor(explicitMonths);
  if (childOrDob && typeof childOrDob === 'object') {
    const fromApi = childOrDob.age_months;
    if (Number.isFinite(fromApi)) return Math.floor(fromApi);
    return ageMonthsFromDateOfBirth(childOrDob.date_of_birth);
  }
  if (typeof childOrDob === 'string') return ageMonthsFromDateOfBirth(childOrDob);
  return null;
}
