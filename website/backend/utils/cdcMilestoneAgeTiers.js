/** CDC Developmental Milestones — age checkpoint bands (some overlap by design). */
export const CDC_MILESTONE_AGE_TIERS = [
  { label: 'by 2 Months', minMonths: 0, maxMonths: 2 },
  { label: 'by 4 Months', minMonths: 2, maxMonths: 4 },
  { label: 'by 6 Months', minMonths: 4, maxMonths: 6 },
  { label: 'by 9 Months', minMonths: 6, maxMonths: 9 },
  { label: 'by 12 Months', minMonths: 9, maxMonths: 12 },
  { label: 'by 18 Months', minMonths: 12, maxMonths: 18 },
  { label: 'by 2 Years', minMonths: 12, maxMonths: 24 },
  { label: 'by 30 Months', minMonths: 24, maxMonths: 30 },
  { label: 'by 3 Years', minMonths: 30, maxMonths: 36 },
  { label: 'by 4 Years', minMonths: 36, maxMonths: 48 },
  { label: 'by 5 Years', minMonths: 48, maxMonths: 60 },
];

/** Legacy labels → canonical CDC label. */
const LEGACY_AGE_LABELS = {
  '0-2 Months': 'by 2 Months',
  '2-4 Months': 'by 4 Months',
  '4-6 Months': 'by 6 Months',
  '6-9 Months': 'by 9 Months',
  '9-12 months (1 Year': 'by 12 Months',
  '9-12 Months': 'by 12 Months',
  '1 Year': 'by 12 Months',
  'by 1 Year': 'by 12 Months',
  '12 Months': 'by 12 Months',
  '12-15 months (1 year and 3 months)': 'by 18 Months',
  '15 Months': 'by 18 Months',
  'by 15 Months': 'by 18 Months',
  '15-18 months (1 year and 6 months)': 'by 18 Months',
  '18 Months': 'by 18 Months',
  '15-24 months (2 Years)': 'by 2 Years',
  '2 Years': 'by 2 Years',
  '15-30 Months(2 years and 6 months)': 'by 30 Months',
  '30 Months': 'by 30 Months',
  '30 to 36 months  ': 'by 3 Years',
  '3 Years': 'by 3 Years',
  '46 to 48 months': 'by 4 Years',
  '4 Years': 'by 4 Years',
  '48 to 60 months': 'by 5 Years',
  '5 Years': 'by 5 Years',
};

export function normalizeCdcAgeLabel(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (LEGACY_AGE_LABELS[raw]) return LEGACY_AGE_LABELS[raw];
  const hit = CDC_MILESTONE_AGE_TIERS.find((t) => t.label === raw);
  return hit?.label ?? raw;
}

export function boundsFromCdcAgeLabel(value) {
  const label = normalizeCdcAgeLabel(value);
  const tier = CDC_MILESTONE_AGE_TIERS.find((t) => t.label === label);
  if (!tier) return null;
  return { minMonths: tier.minMonths, maxMonths: tier.maxMonths };
}

export function childAgeInTier(ageMonths, minMonths, maxMonths) {
  const age = Math.floor(Number(ageMonths));
  if (!Number.isFinite(age) || age < 0) return false;
  const min = Number(minMonths);
  const max = Number(maxMonths);
  return age <= max && (min === 0 || age > min);
}

/**
 * CDC questionnaire band for the child's current checkpoint.
 * e.g. 1 month → "by 2 Months", 24 months → "by 2 Years".
 */
export function tierForChildAge(ageMonths) {
  const age = Math.floor(Number(ageMonths));
  if (!Number.isFinite(age) || age < 0) return null;
  const hit = CDC_MILESTONE_AGE_TIERS.find((t) => t.maxMonths >= age);
  if (hit) return hit;
  return CDC_MILESTONE_AGE_TIERS[CDC_MILESTONE_AGE_TIERS.length - 1];
}

export function tierForMilestoneRow(row) {
  if (!row || typeof row !== 'object') return null;
  const fromLabel = boundsFromCdcAgeLabel(row.age_range);
  if (fromLabel) {
    const tier = CDC_MILESTONE_AGE_TIERS.find(
      (t) => t.minMonths === fromLabel.minMonths && t.maxMonths === fromLabel.maxMonths,
    );
    if (tier) return tier;
  }
  const min = Number(row.age_months_min);
  const max = Number(row.age_months_max);
  if (Number.isFinite(min) && Number.isFinite(max)) {
    const exact = CDC_MILESTONE_AGE_TIERS.find(
      (t) => t.minMonths === min && t.maxMonths === max,
    );
    if (exact) return exact;
    if (min === max) {
      const byCheckpoint = CDC_MILESTONE_AGE_TIERS.find((t) => t.maxMonths === max);
      if (byCheckpoint) return byCheckpoint;
    }
    const byMax = CDC_MILESTONE_AGE_TIERS.find((t) => t.maxMonths === max);
    if (byMax) return byMax;
    // Legacy catalog rows (e.g. 2–3, 4–5, 6–8) use the checkpoint month as min.
    const byCheckpointMin = CDC_MILESTONE_AGE_TIERS.find((t) => t.maxMonths === min);
    if (byCheckpointMin) return byCheckpointMin;
  }
  return null;
}

export function rowMatchesTier(row, tier) {
  if (!tier) return false;
  const rowTier = tierForMilestoneRow(row);
  if (!rowTier) return false;
  return rowTier.minMonths === tier.minMonths && rowTier.maxMonths === tier.maxMonths;
}

export function labelForAgeBounds(minMonths, maxMonths) {
  const min = Number(minMonths);
  const max = Number(maxMonths);
  const hit = CDC_MILESTONE_AGE_TIERS.find(
    (t) => t.minMonths === min && t.maxMonths === max,
  );
  return hit?.label ?? `by ${max} Months`;
}
