/** Keep one row per title/domain/age band — prefer longer instructions, then newest. */
export function dedupeActivitiesByTitle(activities) {
  const list = Array.isArray(activities) ? activities : [];
  const byKey = new Map();

  for (const activity of list) {
    const key = [
      String(activity.title || '').trim().toLowerCase(),
      String(activity.domain || '').trim().toLowerCase(),
      activity.min_age_months,
      activity.max_age_months,
    ].join('|');

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, activity);
      continue;
    }

    const prevLen = String(prev.instructions || '').length;
    const nextLen = String(activity.instructions || '').length;
    const prevCreated = String(prev.created_at || '');
    const nextCreated = String(activity.created_at || '');

    if (nextLen > prevLen || (nextLen === prevLen && nextCreated > prevCreated)) {
      byKey.set(key, activity);
    }
  }

  return [...byKey.values()];
}
