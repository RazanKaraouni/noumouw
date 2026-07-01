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

export function ageLabelFromMonths(months) {
  if (!Number.isFinite(months)) return '—';
  const m = Math.floor(months);
  if (m < 12) return `${m} mo`;
  const y = Math.floor(m / 12);
  const rem = m % 12;
  return rem === 0 ? `${y} y` : `${y} y ${rem} mo`;
}

export function ageLabelFromDateOfBirth(rawDob) {
  return ageLabelFromMonths(ageMonthsFromDateOfBirth(rawDob));
}
