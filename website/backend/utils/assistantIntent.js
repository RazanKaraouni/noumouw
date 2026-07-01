/**
 * Detect what the parent is asking so the reply matches their message.
 */

import { isAutismRelatedGameRequest } from './assistantLanguage.js';
export const SHORT_ANSWER_RULES = `STYLE — SHORT ANSWERS ONLY:
- Maximum 80 words for Q&A replies (games/assignment steps may use a few more)
- Lead with the direct answer in the first sentence
- Use bullets only when listing 2–4 items — no long paragraphs
- No filler ("Great question!", "I'd be happy to help", repeating the question)
- CRITICAL: Reply in the SAME language as the parent's message (Arabic → Arabic, English → English)
- If parent wrote Arabic and assignment/report data is in English, TRANSLATE it into Arabic in your reply`;

export const ALLOWED_ASSISTANT_INTENTS = new Set([
  'explain_assignment',
  'suggest_games',
  'assignment_status',
]);

export function detectAssistantIntent(question) {
  const q = String(question || '').trim();
  const lower = q.toLowerCase();

  const explainAssignment =
    /explain|what does.{0,40}(assignment|activity|task|homework)|assignment mean|assigned (activity|task|homework)|therapist.{0,25}(assign|activity|task|homework)|latest assignment|last assignment|my assignment|explain.{0,20}therapist/.test(
      lower,
    ) ||
    (/[\u0600-\u06FF]/.test(q) &&
      /(شرح|اشرح|مهمة|نشاط المعالج|آخر مهمة)/.test(q) &&
      !/علاج|نطق|therapy/.test(q));

  const requestGames =
    !explainAssignment &&
    (/(?:suggest|recommend|give me|need|want|show).{0,35}(?:game|games|activit|play)|(?:game|games|activit|play).{0,25}(?:idea|suggest|recommend)|what (?:games|activities)|games for|activities for|play ideas?|something to (?:do|play)|what can (?:we|i) (?:do|play)|home activit|اقترح.{0,20}(?:لعبة|نشاط|ألعاب)|فكرة.{0,15}(?:لعبة|نشاط)|(?:لعبة|ألعاب|نشاط).{0,20}(?:اقترح|فكرة)|ما الألعاب|ألعاب ل|نشاط/.test(
      lower,
    ) ||
      (/[\u0600-\u06FF]/.test(q) &&
        /(اقترح|لعبة|ألعاب|نشاط|لعب|أفكار لعب)/.test(q) &&
        !explainAssignment));

  const milestoneReport =
    /explain.{0,30}(milestone|progress).{0,20}report|milestone report|last (generated )?milestone|latest milestone|my milestone report|how is my child|how's my child|child(?:'s)? progress|progress report|معالم|تقدم|تقرير المعالم|كيف حال|تطور طفلي|تقدم طفلي/.test(
      lower,
    ) ||
    (/[\u0600-\u06FF]/.test(q) && /(تقرير المعالم|تقدم الطفل)/.test(q));

  const screeningReport =
    /explain.{0,30}(screening|autism|m-?chat).{0,20}report|screening report|autism (screening )?result|screening result|latest screening|my screening|risk level|نتيجة الفحص|تقرير الفحص|شرح.{0,15}(فحص|توحد)|فحص التوحد/.test(
      lower,
    ) ||
    (/[\u0600-\u06FF]/.test(q) && /(نتيجة الفحص|تقرير الفحص)/.test(q));

  const assignmentStatus =
    !explainAssignment &&
    /assignment.{0,20}(status|pending|complete|done)|pending assignment|completed assignment|حالة المهمة|مهام المعالج/.test(
      lower,
    );

  let primary = 'general';
  if (explainAssignment) primary = 'explain_assignment';
  else if (requestGames) primary = 'suggest_games';
  else if (milestoneReport) primary = 'milestone_report';
  else if (screeningReport) primary = 'screening_report';
  else if (assignmentStatus) primary = 'assignment_status';

  return {
    primary,
    explainAssignment,
    requestGames,
    milestoneReport,
    screeningReport,
    assignmentStatus,
  };
}

export function buildAnswerFocusInstructions(intent, question) {
  const q = String(question || '').trim();
  const lines = [
    SHORT_ANSWER_RULES,
    '',
    `ANSWER FOCUS — respond directly to this exact parent message:`,
    `"${q}"`,
    '',
    'Rules:',
    '- Answer ONLY what they asked; do not add unrelated sections',
    '- Use child data below as evidence; if data is missing, say so briefly',
  ];

  switch (intent.primary) {
    case 'explain_assignment':
      lines.push(
        '- Explain the LAST therapist assignment for this child (newest unless they named another)',
      );
      if (/[\u0600-\u06FF]/.test(q)) {
        lines.push(
          '- Parent wrote in Arabic: translate any English assignment title/instructions into Arabic and explain fully in Arabic',
        );
      }
      break;
    case 'suggest_games':
      lines.push(
        '- Suggest play activities/games suited to this child; avoid repeating the last assignment skill',
      );
      if (isAutismRelatedGameRequest(q)) {
        lines.push(
          '- Autism-related play: use BOTH the saved milestone report AND saved autism screening report from the database',
        );
        lines.push(
          '- End the reply with the medical disclaimer line provided in the prompt',
        );
      }
      break;
    case 'assignment_status':
      lines.push('- Summarize therapist assignment statuses only');
      if (/[\u0600-\u06FF]/.test(q)) {
        lines.push(
          '- Parent wrote in Arabic: translate English assignment titles/statuses into Arabic',
        );
      }
      break;
    default:
      lines.push('- Answer only if the question fits your allowed topics');
      break;
  }

  return lines.join('\n');
}
