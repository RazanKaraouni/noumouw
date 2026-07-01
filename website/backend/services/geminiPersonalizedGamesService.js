import { callGeminiText } from './geminiClient.js';
import { canonicalizeActivityDomain } from '../utils/resolveActivityDomain.js';
import { SHORT_ANSWER_RULES } from '../utils/assistantIntent.js';
import {
  isArabicText,
  isAutismRelatedGameRequest,
  medicalAdviceDisclaimer,
  replyLanguageInstruction,
} from '../utils/assistantLanguage.js';
import { resolveDomainsNeedingAttention } from './lastGeneratedReportsService.js';

const ALLOWED_DOMAINS = ['Cognitive', 'Motor', 'Language', 'Social'];

function parseGeminiJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : raw;
  return JSON.parse(candidate);
}

function domainFromQuestion(question) {
  const t = String(question || '').toLowerCase();
  if (/\bmotor\b|gross motor|fine motor|حرك|حركي/.test(t)) return 'Motor';
  if (/\blanguage\b|\bspeech\b|لغوي|لغة|نطق/.test(t)) return 'Language';
  if (/\bsocial\b|اجتماعي|اجتماع/.test(t)) return 'Social';
  if (/\bcognitive\b|إدراكي|إدراك|تفكير/.test(t)) return 'Cognitive';
  return null;
}

/**
 * Plan which domain each game must target.
 */
export function resolveGameDomainPlan(question, milestoneReport, context = null) {
  if (isAutismRelatedGameRequest(question) && context) {
    const focus = resolveDomainsNeedingAttention(context);
    const picked =
      focus.length >= 2
        ? [focus[0], focus[1]]
        : focus.length === 1
          ? [focus[0], focus[0]]
          : ['Social', 'Language'];
    return {
      gameDomains: picked,
      focusDomains: focus.length ? focus : ['Social', 'Language'],
      source: 'autism_reports',
      oneGamePerDomain: picked[0] !== picked[1],
    };
  }

  const asked = domainFromQuestion(question);
  if (asked) {
    return {
      gameDomains: [asked, asked],
      focusDomains: [asked],
      source: 'parent_request',
      oneGamePerDomain: false,
    };
  }

  const focus = (milestoneReport?.focus_domains || [])
    .map((d) => canonicalizeActivityDomain(d) || d)
    .filter((d) => ALLOWED_DOMAINS.includes(d));

  if (focus.length >= 2) {
    return {
      gameDomains: [focus[0], focus[1]],
      focusDomains: focus.slice(0, 4),
      source: 'milestone_focus',
      oneGamePerDomain: true,
    };
  }

  if (focus.length === 1) {
    return {
      gameDomains: [focus[0], focus[0]],
      focusDomains: focus,
      source: 'milestone_focus',
      oneGamePerDomain: false,
    };
  }

  return {
    gameDomains: ['Motor', 'Language'],
    focusDomains: ['Motor', 'Language'],
    source: 'default',
    oneGamePerDomain: true,
  };
}

function formatDomainBreakdown(breakdown) {
  if (!breakdown || !Object.keys(breakdown).length) return 'No domain data yet.';
  return Object.entries(breakdown)
    .filter(([, s]) => s.total > 0)
    .map(
      ([domain, s]) =>
        `- ${domain}: ${s.completed}/${s.total} done, ${s.overdue} overdue (${s.completion_rate}% complete)`,
    )
    .join('\n');
}

function formatOverdueForDomain(milestones, domain, limit = 5) {
  const overdue = (milestones || []).filter(
    (m) => m.status === 'Overdue' && (m.domain === domain || !domain),
  );
  if (!overdue.length) return 'None in this domain — reinforce upcoming skills.';
  return overdue
    .slice(0, limit)
    .map((m) => `- ${m.title} (target ${m.target_age_months} mo)`)
    .join('\n');
}

function formatPendingAssignments(assignments, domain) {
  const pending = (assignments || []).filter((a) => {
    const status = String(a.status || '').toLowerCase();
    if (!['pending', 'incomplete'].includes(status)) return false;
    if (!domain) return true;
    const d = canonicalizeActivityDomain(a.domain) || a.domain;
    return d === domain;
  });
  if (!pending.length) return 'None.';
  return pending
    .slice(0, 4)
    .map((a) => `- ${a.title}`)
    .join('\n');
}

function filterReferenceActivities(activities, domains) {
  const allowed = new Set(domains);
  return (activities || []).filter((a) => {
    const d = canonicalizeActivityDomain(a.domain);
    return d && allowed.has(d);
  });
}

function formatReferenceActivities(activities) {
  return (activities || [])
    .slice(0, 6)
    .map(
      (a, i) =>
        `${i + 1}. [${a.domain}] ${a.title}\n   ${a.instructions || 'No steps on file.'}`,
    )
    .join('\n');
}

function formatSavedMilestoneForGames(report) {
  if (!report) return 'No saved milestone report — use live milestone data below.';
  const lines = [
    `Generated: ${report.generated_at || report.saved_at || 'unknown'}`,
    `Completion: ${report.overall_completion_percentage ?? 'n/a'}% (${report.completed_milestones ?? '?'}/${report.total_milestones ?? '?'} milestones)`,
  ];
  if (report.by_category?.length) {
    for (const c of report.by_category) {
      lines.push(
        `- ${c.category}: ${c.completed}/${c.total} (${c.completion_percentage}% complete)`,
      );
    }
  }
  if (report.overdue_milestones?.length) {
    lines.push('Overdue milestones:');
    for (const m of report.overdue_milestones.slice(0, 6)) {
      lines.push(
        `- ${m.milestone_title || m.title} (${m.milestone_category || m.category || 'general'})`,
      );
    }
  }
  return lines.join('\n');
}

function formatSavedScreeningForGames(report) {
  if (!report) return 'No saved autism screening report — use live screening summary below.';
  const lines = [
    `Generated: ${report.generated_at || report.saved_at || 'unknown'}`,
    `Score: ${report.score ?? 'n/a'}/${report.total_questions ?? 'n/a'}`,
    `Risk level: ${report.risk_level ?? 'unknown'}`,
  ];
  if (report.failed_questions?.length) {
    lines.push('Concerning screening responses:');
    for (const f of report.failed_questions.slice(0, 6)) {
      const q = f.question_text || `Question ${f.question_number || ''}`.trim();
      const a = f.selected_answer ?? '';
      lines.push(`- ${q}${a ? `: ${a}` : ''}`);
    }
  }
  return lines.join('\n');
}

function buildDomainAssignmentBlock(plan) {
  const [g1, g2] = plan.gameDomains;
  if (plan.oneGamePerDomain && g1 !== g2) {
    return `DOMAIN ASSIGNMENT (mandatory):
- Game 1 → ${g1} domain only
- Game 2 → ${g2} domain only`;
  }
  return `DOMAIN FOCUS (mandatory):
- Both games → ${g1} domain (different skills within this domain)`;
}

function buildPersonalizedGamesPrompt(context, question) {
  const {
    child,
    milestone_report,
    latest_screening,
    latest_milestone_report,
    latest_screening_report,
    assignments,
    reference_activities,
  } = context;

  const autismGames = isAutismRelatedGameRequest(question);
  const plan = resolveGameDomainPlan(question, milestone_report, context);
  const domainRefs = filterReferenceActivities(
    reference_activities,
    [...new Set(plan.focusDomains)],
  );

  const riskLevel =
    latest_screening_report?.risk_level ||
    latest_screening?.risk_level ||
    null;
  const riskNote =
    riskLevel === 'High'
      ? 'Screening risk is High — prefer calm, predictable, low-sensory games.'
      : riskLevel === 'Moderate'
        ? 'Screening risk is Moderate — keep structure clear and gentle.'
        : autismGames
          ? 'Use warm, structured play suited to social-communication practice.'
          : 'Use warm, playful tone suited to everyday practice.';

  const overdueByDomain = plan.focusDomains
    .map(
      (d) =>
        `${d} overdue milestones:\n${formatOverdueForDomain(milestone_report.milestones, d)}`,
    )
    .join('\n\n');

  const autismReportsBlock = autismGames
    ? `
AUTISM-RELATED PLAY REQUEST (mandatory — personalize BOTH games using these saved reports):

LAST SAVED MILESTONE REPORT (database):
${formatSavedMilestoneForGames(latest_milestone_report)}

LAST SAVED AUTISM SCREENING REPORT (database):
${formatSavedScreeningForGames(latest_screening_report)}

- Target skills gaps shown in BOTH reports above
- If screening risk is Moderate/High: calm, predictable, low-sensory games
- These are home play ideas only — not diagnosis or therapy
`
    : '';

  const disclaimerNote = autismGames
    ? `\nEnd the intro thinking about: play ideas only; parent should contact therapist for medical advice.`
    : '';

  return `You are a pediatric play coach for the Noumouw parent app.

${SHORT_ANSWER_RULES}

${replyLanguageInstruction(question)}

Create exactly 2 ORIGINAL, personalized home games. Keep all text brief.
All JSON string values (intro, title, materials, steps, why_personalized) must be in the parent's language — if parent wrote Arabic, every field must be Arabic (translate any English context).
${disclaimerNote}

CHILD:
- Name: ${child.full_name}
- Age: ${child.age_months} months
${autismReportsBlock}

${buildDomainAssignmentBlock(plan)}

DOMAIN FOCUS SOURCE: ${plan.source}
DOMAINS NEEDING FOCUS: ${plan.focusDomains.join(', ')}

DOMAIN BREAKDOWN (live tracking):
${formatDomainBreakdown(milestone_report.category_breakdown)}

OVERDUE MILESTONES BY FOCUS DOMAIN:
${overdueByDomain}

PENDING THERAPIST ASSIGNMENTS BY DOMAIN:
${plan.focusDomains.map((d) => `${d}: ${formatPendingAssignments(assignments, d)}`).join('\n')}

SCREENING SUMMARY: ${latest_screening ? `risk ${latest_screening.risk_level}, score ${latest_screening.score}` : 'none on file'}
${riskNote}

REFERENCE ACTIVITIES FOR THESE DOMAINS (style/age guide only — do not copy titles):
${formatReferenceActivities(domainRefs) || 'Use standard early-childhood play for the target domain.'}

PARENT REQUEST (games must match what they asked for):
"${question}"

Read their message carefully — if they asked for motor games, language games, autism-related play, or a specific domain, honor that. If vague, use focus domains from the reports.

REQUIREMENTS:
- Each game's "domain" field MUST match the DOMAIN ASSIGNMENT above
- why_personalized: max 15 words
- materials: max 5 words (comma-separated)
- steps: exactly 3 short numbered steps (one line each)
- estimated_minutes between 5 and 15
- intro: max 12 words

Respond with ONLY valid JSON:
{
  "intro": "short sentence, max 12 words",
  "focus_domains": ${JSON.stringify(plan.focusDomains)},
  "games": [
    {
      "title": "original game name",
      "domain": "${plan.gameDomains[0]}",
      "materials": "comma-separated list",
      "steps": "1. ...\\n2. ...\\n3. ...",
      "estimated_minutes": 10,
      "why_personalized": "max 15 words"
    },
    {
      "title": "second game name",
      "domain": "${plan.gameDomains[1]}",
      "materials": "comma-separated list",
      "steps": "1. ...\\n2. ...\\n3. ...",
      "estimated_minutes": 10,
      "why_personalized": "max 15 words"
    }
  ]
}`;
}

function enforceGameDomains(parsed, plan) {
  const games = Array.isArray(parsed.games) ? parsed.games : [];
  return games.map((g, i) => {
    const expected = plan.gameDomains[i] || plan.gameDomains[0];
    const domain = canonicalizeActivityDomain(g.domain) || expected;
    return {
      ...g,
      domain: ALLOWED_DOMAINS.includes(domain) ? domain : expected,
    };
  });
}

function localizeDomainLabel(domain, isArabic) {
  if (!isArabic) return domain;
  const map = {
    Motor: 'حركي',
    Language: 'لغوي',
    Cognitive: 'إدراكي',
    Social: 'اجتماعي',
    General: 'عام',
  };
  return map[domain] || domain;
}

function formatGamesAnswer(parsed, childName, plan, question) {
  const isArabic = isArabicText(question);
  const focusLabel = (parsed.focus_domains || plan.focusDomains || [])
    .map((d) => localizeDomainLabel(d, isArabic))
    .join(isArabic ? '، ' : ', ');
  const intro = String(
    parsed.intro ||
      (isArabic
          ? `ألعاب لـ ${childName}${focusLabel ? ` (${focusLabel})` : ''}:`
          : `Games for ${childName}${focusLabel ? ` (${focusLabel})` : ''}:`),
  ).trim();

  const games = enforceGameDomains(parsed, plan);
  if (!games.length) return intro;

  const materialsLabel = isArabic ? 'المواد:' : 'Materials:';

  const blocks = games.map((g, i) => {
    const title = String(g.title || (isArabic ? `لعبة ${i + 1}` : `Game ${i + 1}`)).trim();
    const domain = localizeDomainLabel(g.domain || 'General', isArabic);
    const why = String(g.why_personalized || '').trim();
    const materials = String(g.materials || (isArabic ? 'أدوات منزلية' : 'home items')).trim();
    const steps = String(g.steps || '').trim();
    const minutes = Number(g.estimated_minutes);
    const timeLabel = Number.isFinite(minutes)
        ? (isArabic ? ` · ${minutes} د` : ` · ${minutes} min`)
        : '';

    const lines = [
      `${i + 1}. ${title} (${domain}${timeLabel})`,
      why ? `→ ${why}` : '',
      `${materialsLabel} ${materials}`,
      steps,
    ].filter(Boolean);
    return lines.join('\n');
  });

  return [intro, '', ...blocks].join('\n').trim();
}

/**
 * Generate 2 personalized home games using full child context and domain focus.
 */
export async function generatePersonalizedGames(context, question) {
  const plan = resolveGameDomainPlan(question, context.milestone_report, context);
  const prompt = buildPersonalizedGamesPrompt(context, question);
  const text = await callGeminiText(prompt, {
    temperature: 0.72,
    responseMimeType: 'application/json',
  });

  let parsed;
  try {
    parsed = parseGeminiJson(text);
  } catch {
    throw new Error('Failed to parse personalized games from Gemini.');
  }

  let answer = formatGamesAnswer(parsed, context.child.full_name, plan, question);
  if (isAutismRelatedGameRequest(question)) {
    answer = `${answer}\n\n${medicalAdviceDisclaimer(question)}`;
  }
  return {
    answer,
    game_count: Array.isArray(parsed.games) ? parsed.games.length : 0,
    focus_domains: plan.focusDomains,
    game_domains: plan.gameDomains,
    autism_related: isAutismRelatedGameRequest(question),
  };
}
