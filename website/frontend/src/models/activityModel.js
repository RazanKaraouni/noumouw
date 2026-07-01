/** Maps activity library domain labels to assignment domain values. */
export function mapActivityDomainToAssignment(domain) {
  const d = String(domain || '').trim().toLowerCase();
  if (d === 'language') return 'speech';
  if (['speech', 'cognitive', 'motor', 'social'].includes(d)) return d;
  return 'cognitive';
}

export function buildAssignmentFromActivity(activity) {
  return {
    title: activity.title,
    description: activity.instructions || null,
    domain: mapActivityDomainToAssignment(activity.domain),
    priority: 'medium',
    due_date: null,
  };
}

export function activityAgeLabel(min, max) {
  if (min == null || max == null) return '';
  return `${min}–${max} mo`;
}
