/**
 * CDC Developmental Milestones — age checkpoint bands (some overlap by design).
 * Stored as age_months_min / age_months_max in PostgreSQL.
 */
export const CDC_MILESTONE_AGE_TIERS = [
  { label: 'by 2 Months', minMonths: 0, maxMonths: 2 },
  { label: 'by 4 Months', minMonths: 2, maxMonths: 4 },
  { label: 'by 6 Months', minMonths: 4, maxMonths: 6 },
  { label: 'by 9 Months', minMonths: 6, maxMonths: 9 },
  { label: 'by 12 Months', minMonths: 9, maxMonths: 12 },
  { label: 'by 18 Months', minMonths: 12, maxMonths: 18 },
  { label: 'by 2 Years', minMonths: 12, maxMonths: 24 }, // Overlaps min with 18m by design
  { label: 'by 30 Months', minMonths: 24, maxMonths: 30 },
  { label: 'by 3 Years', minMonths: 30, maxMonths: 36 },
  { label: 'by 4 Years', minMonths: 36, maxMonths: 48 },
  { label: 'by 5 Years', minMonths: 48, maxMonths: 60 },
  //{ label: 'by 7 Years', minMonths: 60, maxMonths: 84 },
  //{ label: 'by 9 Years', minMonths: 84, maxMonths: 108 },
  //{ label: 'by 11 Years', minMonths: 108, maxMonths: 132 },
];

/** Admin milestone forms / filters: { label, min, max } */
export const CDC_MILESTONE_AGE_RANGES = CDC_MILESTONE_AGE_TIERS.map((t) => ({
  label: t.label,
  min: t.minMonths,
  max: t.maxMonths,
}));

// Made comprehensive to catch exact string matches safely
const LEGACY_AGE_LABELS = {
  '2 Months': 'by 2 Months',
  '4 Months': 'by 4 Months',
  '6 Months': 'by 6 Months',
  '9 Months': 'by 9 Months',
  '1 Year': 'by 12 Months',
  '12 Months': 'by 12 Months',
  'by 1 Year': 'by 12 Months',
  '15 Months': 'by 18 Months',
  'by 15 Months': 'by 18 Months',
  '18 Months': 'by 18 Months',
  '2 Years': 'by 2 Years',
  '30 Months': 'by 30 Months',
  '3 Years': 'by 3 Years',
  '4 Years': 'by 4 Years',
  '5 Years': 'by 5 Years',
  
  // Add the missing older childhood bands here:
  //'7 Years': 'by 7 Years',
  //'9 Years': 'by 9 Years',
  //'11 Years': 'by 11 Years',
};

export function normalizeCdcAgeLabel(value) {
  let raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';

  // 1. Direct Legacy Match
  if (LEGACY_AGE_LABELS[raw]) return LEGACY_AGE_LABELS[raw];

  // 2. Structural Fix: If it doesn't start with "by ", dynamically prepend it 
  if (!/^by\s+/i.test(raw)) {
    raw = `by ${raw}`;
  }

  // 3. Direct Tier Match
  const strictHit = CDC_MILESTONE_AGE_TIERS.find((t) => t.label === raw);
  if (strictHit) return strictHit.label;

  // 4. Case-Insensitive Fallback Match
  const lowerRaw = raw.toLowerCase();
  const caseHit = CDC_MILESTONE_AGE_TIERS.find((t) => t.label.toLowerCase() === lowerRaw);
  if (caseHit) return caseHit.label;

  return raw;
}
export function boundsFromCdcAgeLabel(value) {
  const normalizedLabel = normalizeCdcAgeLabel(value);
  if (!normalizedLabel) return null;

  // Finds the exact object matching the text label string
  const tier = CDC_MILESTONE_AGE_TIERS.find((t) => t.label === normalizedLabel);
  
  if (!tier) return null;
  return { minMonths: tier.minMonths, maxMonths: tier.maxMonths };
}