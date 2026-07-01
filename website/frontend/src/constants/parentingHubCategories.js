/** Matches mobile `parenting_hub_categories.dart` browse/filter categories. */
export const PARENTING_HUB_CATEGORIES = [
  { value: 'child_development', label: 'Child Development' },
  { value: 'emotional_wellbeing', label: 'Emotional Well-being' },
  { value: 'behavior_guidance', label: 'Behavior Guidance' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'autism_support', label: 'Autism Support' },
  { value: 'screen_time', label: 'Screen Time' },
  { value: 'positive_discipline', label: 'Positive Discipline' },
  { value: 'social_skills', label: 'Social Skills' },
  { value: 'parent_self_care', label: 'Parent Self-Care' },
];

/** Older tips stored before hub categories were used. */
export const LEGACY_TIP_CATEGORY_LABELS = {
  general: 'General',
  emotional_regulation: 'Emotional Regulation',
  communication: 'Communication',
  routines: 'Routines',
};

export const VALID_TIP_CATEGORY_VALUES = new Set([
  ...PARENTING_HUB_CATEGORIES.map((c) => c.value),
  ...Object.keys(LEGACY_TIP_CATEGORY_LABELS),
]);

export function tipCategoryLabel(category) {
  const hub = PARENTING_HUB_CATEGORIES.find((c) => c.value === category);
  if (hub) return hub.label;
  return LEGACY_TIP_CATEGORY_LABELS[category] || category || '—';
}
