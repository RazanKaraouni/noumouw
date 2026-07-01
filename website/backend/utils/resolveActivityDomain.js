/** Matches `activity_library.domain` (capitalized). */
const ALLOWED_DOMAINS = ['Cognitive', 'Motor', 'Social', 'Language'];

const GOAL_TO_DOMAIN = {
  cognitive: 'Cognitive',
  motor: 'Motor',
  social: 'Social',
  language: 'Language',
  auto: null,
  based_on_whats_needed: null,
};

/** Map assignment domain (lowercase, may use `speech`) to activity library domain. */
export function assignmentDomainToActivityDomain(raw) {
  if (typeof raw !== 'string') return null;
  const d = raw.trim().toLowerCase();
  if (d === 'speech' || d === 'language') return 'Language';
  return ALLOWED_DOMAINS.find((x) => x.toLowerCase() === d) || null;
}

export function canonicalizeActivityDomain(value) {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  if (lower === 'speech') return 'Language';
  return ALLOWED_DOMAINS.find((d) => d.toLowerCase() === lower) || null;
}

function countDomains(rows, pickDomain) {
  const counts = {};
  for (const row of rows || []) {
    const domain = pickDomain(row);
    if (!domain) continue;
    counts[domain] = (counts[domain] || 0) + 1;
  }
  return counts;
}

function topDomain(counts) {
  let best = null;
  let bestCount = 0;
  for (const [domain, count] of Object.entries(counts || {})) {
    if (count > bestCount) {
      best = domain;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Resolve activity domain from parent goal or child context.
 * @param {string} developmentGoal - cognitive|motor|social|language|auto
 * @param {{ overdueMilestones?: Array, pendingAssignments?: Array }} context
 */
export function resolveActivityDomain(developmentGoal, context = {}) {
  const key = String(developmentGoal || 'auto').trim().toLowerCase();
  const explicit = GOAL_TO_DOMAIN[key];
  if (explicit) return explicit;

  const overdueCounts = countDomains(context.overdueMilestones, (m) =>
    canonicalizeActivityDomain(m.milestone_category ?? m.category),
  );
  const fromOverdue = topDomain(overdueCounts);
  if (fromOverdue) return fromOverdue;

  const assignmentCounts = countDomains(context.pendingAssignments, (a) =>
    assignmentDomainToActivityDomain(a.domain),
  );
  const fromAssignments = topDomain(assignmentCounts);
  if (fromAssignments) return fromAssignments;

  return 'Cognitive';
}

export { ALLOWED_DOMAINS };
