import {
  CDC_MILESTONE_AGE_TIERS,
  CDC_MILESTONE_AGE_RANGES,
  boundsFromCdcAgeLabel,
} from '../constants/cdcMilestoneAgeTiers.js';

export { CDC_MILESTONE_AGE_TIERS, CDC_MILESTONE_AGE_RANGES };

/**
 * Activity / library age windows: (min, max] with min=0 inclusive on the lower bound.
 */
export function childAgeInTier(ageMonths, minMonths, maxMonths) {
  const age = Math.floor(Number(ageMonths));
  if (!Number.isFinite(age) || age < 0) return false;
  const min = Number(minMonths);
  const max = Number(maxMonths);
  return age <= max && (min === 0 || age > min);
}

/**
 * CDC questionnaire band for a child: next checkpoint after their age.
 * e.g. 1 month → "by 2 Months", 3 months → "by 4 Months".
 */
export function tierForChildAge(ageMonths) {
  const age = Math.floor(Number(ageMonths));
  if (!Number.isFinite(age) || age < 0) return null;
  const hit = CDC_MILESTONE_AGE_TIERS.find((t) => t.maxMonths > age);
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
  if (rowTier) return rowTier.minMonths === tier.minMonths && rowTier.maxMonths === tier.maxMonths;
  return false;
}

export function labelForAgeBounds(minMonths, maxMonths) {
  const min = Number(minMonths);
  const max = Number(maxMonths);
  const tier = CDC_MILESTONE_AGE_TIERS.find(
    (t) => t.minMonths === min && t.maxMonths === max,
  );
  return tier?.label ?? `by ${max} Months`;
}

export function findAgeRangePreset(minMonths, maxMonths) {
  const min = Number(minMonths);
  const max = Number(maxMonths);
  return CDC_MILESTONE_AGE_RANGES.find((r) => r.min === min && r.max === max) || null;
}

export function agePresetKeyFromBounds(minMonths, maxMonths) {
  const preset = findAgeRangePreset(minMonths, maxMonths);
  return preset ? `${preset.min}-${preset.max}` : '';
}

export function milestoneFieldsFromAgePreset(presetKey) {
  const tier = CDC_MILESTONE_AGE_RANGES.find((r) => `${r.min}-${r.max}` === presetKey);
  if (!tier) return null;
  return {
    age_months_min: tier.min,
    age_months_max: tier.max,
    age_range: tier.label,
  };
}

export function activityAgeFieldsFromPreset(presetKey) {
  const tier = CDC_MILESTONE_AGE_RANGES.find((r) => `${r.min}-${r.max}` === presetKey);
  if (!tier) return null;
  return {
    min_age_months: tier.min,
    max_age_months: tier.max,
  };
}
