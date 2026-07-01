import {
  CDC_MILESTONE_AGE_TIERS,
  normalizeCdcAgeLabel,
} from '../constants/cdcMilestoneAgeTiers.js';

export const AGE_RANGE_MAX_LENGTH = 50;

export const TIP_AGE_RANGE_OPTIONS = CDC_MILESTONE_AGE_TIERS.map((tier) => ({
  value: tier.label,
  label: tier.label,
}));

export function ageRangeIncludesNumber(value) {
  return /\d/.test(String(value ?? '').trim());
}

export function validateTipAgeRange(value) {
  const ageRange = String(value ?? '').trim();
  if (!ageRange) return 'Please select an age range.';
  const normalized = normalizeCdcAgeLabel(ageRange);
  const hit = CDC_MILESTONE_AGE_TIERS.some((tier) => tier.label === normalized);
  if (!hit) return 'Please select a valid CDC age range.';
  return '';
}

export function ageRangeFromTip(tip) {
  const stored = tip?.age_range;
  if (typeof stored === 'string' && stored.trim()) {
    return normalizeCdcAgeLabel(stored.trim());
  }
  return '';
}

export function formatTipAgeRange(tip) {
  const label = ageRangeFromTip(tip);
  return label || '—';
}
