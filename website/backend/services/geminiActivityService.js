import { canonicalizeActivityDomain, ALLOWED_DOMAINS } from '../utils/resolveActivityDomain.js';
import { callGeminiText } from './geminiClient.js';

const VALID_MOODS = new Set(['calm', 'energetic', 'tired', 'fussy', 'curious']);
const VALID_TIMES = new Set(['5', '15', '30+']);

function maxMinutesForTimeBucket(bucket) {
  if (bucket === '5') return 5;
  if (bucket === '15') return 15;
  return 45;
}

function buildPrompt({
  context,
  resolvedDomain,
  referenceActivities,
  mood,
  availableTime,
}) {
  const refs = (referenceActivities || [])
    .map(
      (a, i) =>
        `${i + 1}. [${a.domain}] ${a.title}\n   Instructions: ${a.instructions}`,
    )
    .join('\n');

  const overdueList =
    context.overdueMilestones?.length > 0
      ? context.overdueMilestones
          .slice(0, 8)
          .map((m) => `- ${m.title} (${m.milestone_category})`)
          .join('\n')
      : 'None noted.';

  const assignmentList =
    context.pendingAssignments?.length > 0
      ? context.pendingAssignments
          .slice(0, 6)
          .map((a) => `- ${a.title} [${a.domain || 'general'}]`)
          .join('\n')
      : 'None.';

  const riskNote =
    context.latestRiskLevel === 'High'
      ? 'Use extra calm, predictable steps and low sensory demand.'
      : context.latestRiskLevel === 'Moderate'
        ? 'Keep structure clear and offer gentle encouragement.'
        : 'Use warm, playful tone appropriate for everyday practice.';

  return `You are a pediatric development activity coach for parents.

Create ONE original home activity for a child. Do NOT copy reference activities verbatim — use them only for tone, structure, and age-appropriateness.

CHILD CONTEXT:
- Name: ${context.child?.full_name || 'Child'}
- Age: ${context.ageMonths} months
- Target domain: ${resolvedDomain}
- Latest autism screening risk: ${context.latestRiskLevel || 'unknown'}
- Overdue milestones:
${overdueList}
- Therapist focus (pending assignments):
${assignmentList}

PARENT INPUTS:
- Child's mood right now: ${mood}
- Available time: ${availableTime} minutes
- ${riskNote}

REFERENCE ACTIVITIES (style guides only):
${refs || 'No references available — use standard early-childhood best practices.'}

REQUIREMENTS:
- Activity must fit within ${availableTime === '30+' ? '30–45' : availableTime} minutes
- Adapt energy level to mood "${mood}" (e.g. tired/fussy → shorter, calmer steps)
- Align with domain "${resolvedDomain}"
- Use simple materials found at home
- Write clear numbered steps parents can follow

Respond with ONLY valid JSON (no markdown):
{
  "title": "short activity name",
  "instructions": "numbered steps as a single string with newlines",
  "domain": "${resolvedDomain}",
  "estimated_minutes": number,
  "why_this_activity": "one sentence explaining why this fits today"
}`;
}

function parseGeminiJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : raw;
  return JSON.parse(candidate);
}

/**
 * Generate a custom activity via Gemini.
 */
export async function generateActivitySuggestion({
  context,
  resolvedDomain,
  referenceActivities,
  mood,
  availableTime,
}) {
  const normalizedMood = String(mood || '').trim().toLowerCase();
  const normalizedTime = String(availableTime || '').trim();
  if (!VALID_MOODS.has(normalizedMood)) {
    const err = new Error('Invalid mood. Use: calm, energetic, tired, fussy, curious.');
    err.status = 400;
    throw err;
  }
  if (!VALID_TIMES.has(normalizedTime)) {
    const err = new Error('Invalid available_time. Use: 5, 15, or 30+.');
    err.status = 400;
    throw err;
  }

  const prompt = buildPrompt({
    context,
    resolvedDomain,
    referenceActivities,
    mood: normalizedMood,
    availableTime: normalizedTime,
  });

  const text = await callGeminiText(prompt, {
    temperature: 0.7,
    responseMimeType: 'application/json',
  });

  let parsed;
  try {
    parsed = parseGeminiJson(text);
  } catch {
    throw new Error('Failed to parse activity suggestion from Gemini.');
  }

  const domain =
    canonicalizeActivityDomain(parsed.domain) ||
    canonicalizeActivityDomain(resolvedDomain) ||
    'Cognitive';

  if (!ALLOWED_DOMAINS.includes(domain)) {
    parsed.domain = resolvedDomain;
  } else {
    parsed.domain = domain;
  }

  const maxMin = maxMinutesForTimeBucket(normalizedTime);
  const minMin = normalizedTime === '30+' ? 30 : Number(normalizedTime);
  let est = Number(parsed.estimated_minutes);
  if (!Number.isFinite(est)) est = minMin;
  parsed.estimated_minutes = Math.min(maxMin, Math.max(1, Math.round(est)));

  parsed.title = String(parsed.title || 'Suggested activity').trim();
  parsed.instructions = String(parsed.instructions || '').trim();
  parsed.why_this_activity = String(parsed.why_this_activity || '').trim();

  return parsed;
}
