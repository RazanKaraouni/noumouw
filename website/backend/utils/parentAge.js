const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseParentDateOfBirth(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim();
  if (!ISO_DATE_REGEX.test(normalized)) return null;
  const [year, month, day] = normalized.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return normalized;
}

/** Whole years from YYYY-MM-DD (local calendar). */
export function ageYearsFromDateOfBirth(isoDate) {
  const parsed = parseParentDateOfBirth(isoDate);
  if (!parsed) return null;
  const [year, month, day] = parsed.split('-').map((part) => Number.parseInt(part, 10));
  const dob = new Date(year, month - 1, day);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** API rows: age mirrors date_of_birth when present. */
export function enrichParentRow(row) {
  if (!row || typeof row !== 'object') return row;
  const computed = row.date_of_birth ? ageYearsFromDateOfBirth(row.date_of_birth) : null;
  return {
    ...row,
    age: computed ?? row.age ?? null,
  };
}

export function enrichParentRows(rows) {
  return (rows || []).map(enrichParentRow);
}
