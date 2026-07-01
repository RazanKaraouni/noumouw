import { callGeminiText } from './geminiClient.js';
import { explainTherapistAssignments } from './assignmentExplainService.js';
import { generatePersonalizedGames } from './geminiPersonalizedGamesService.js';
import { loadFullAssistantContext } from './parentAssistantContextService.js';
import {
  buildAnswerFocusInstructions,
  detectAssistantIntent,
  SHORT_ANSWER_RULES,
} from '../utils/assistantIntent.js';
import {
  cannotAnswerMessageFor,
  classifyAssistantQuestion,
  greetingRedirectMessage,
} from '../utils/assistantQuestionScope.js';
import { replyLanguageInstruction, assignmentArabicInstruction } from '../utils/assistantLanguage.js';

export { detectAssistantIntent as detectQuestionFocus };

function formatAssignments(assignments) {
  if (!assignments?.length) return 'No therapist assignments yet.';
  return assignments
    .map(
      (a, i) =>
        `${i + 1}. "${a.title}" — status: ${a.status}, domain: ${a.domain || 'general'}, therapist: ${a.therapist_name}${a.due_date ? `, due: ${a.due_date}` : ''}${a.description ? `\n   Instructions: ${a.description}` : ''}`,
    )
    .join('\n');
}

function formatNewestAssignment(a) {
  if (!a) return 'None — therapist has not assigned an activity yet.';
  const lines = [
    `Title: ${a.title}`,
    `Status: ${a.status}`,
    `Domain: ${a.domain || 'general'}`,
    `Therapist: ${a.therapist_name}${a.therapist_profession ? ` (${a.therapist_profession})` : ''}`,
  ];
  if (a.due_date) lines.push(`Due: ${a.due_date}`);
  if (a.description) lines.push(`Therapist instructions: ${a.description}`);
  if (a.therapist_reply) lines.push(`Therapist note: ${a.therapist_reply}`);
  if (a.parent_notes) lines.push(`Parent notes: ${a.parent_notes}`);
  return lines.join('\n');
}

function buildChatPrompt(context, question, intent) {
  const { child, newest_assignment } = context;

  const answerFocus = buildAnswerFocusInstructions(intent, question);

  const assignmentNote =
    intent.primary === 'explain_assignment' || intent.primary === 'assignment_status'
      ? `\n${assignmentArabicInstruction(question)}\nNOTE: Assignment data below may be in English — translate and explain in the parent's language.\n`
      : '';

  return `You are a parenting assistant for the Noumouw app.

${answerFocus}

${replyLanguageInstruction(question)}
${assignmentNote}

CHILD (active child from parent settings): ${child.full_name} (${child.age_months} months old)

LAST THERAPIST ASSIGNMENT (use for assignment questions):
${formatNewestAssignment(newest_assignment)}

ALL ASSIGNMENTS:
${formatAssignments(context.assignments)}

PARENT MESSAGE (your reply must answer THIS exactly):
"${question}"

RULES:
${SHORT_ANSWER_RULES}
- Answer only what the parent asked — not a generic overview
- If clearly unrelated to allowed topics, reply EXACTLY: ${cannotAnswerMessageFor(question)}
- Plain text only`;
}

/**
 * Answer a parent question using active-child context + Gemini.
 */
export async function answerParentAssistantQuestion(parentUserId, childId, question) {
  const q = String(question || '').trim();
  if (!q) {
    const err = new Error('question is required.');
    err.status = 400;
    throw err;
  }

  const scope = classifyAssistantQuestion(q);
  if (scope === 'off_topic') {
    return {
      answer: cannotAnswerMessageFor(q),
      focus_domains: [],
      child_name: null,
      age_months: null,
      personalized_games: false,
      out_of_scope: true,
    };
  }
  if (scope === 'greeting') {
    const context = await loadFullAssistantContext(parentUserId, childId);
    return {
      answer: greetingRedirectMessage(q),
      focus_domains: [],
      child_name: context.child.full_name,
      age_months: context.child.age_months,
      personalized_games: false,
      out_of_scope: false,
    };
  }

  const context = await loadFullAssistantContext(parentUserId, childId);
  const intent = detectAssistantIntent(q);

  let answer;
  let gameFocusDomains;

  if (intent.explainAssignment) {
    const result = await explainTherapistAssignments(parentUserId, childId, q);
    answer = result.explanation;
  } else if (intent.requestGames) {
    const games = await generatePersonalizedGames(context, q);
    answer = games.answer;
    gameFocusDomains = games.focus_domains;
  } else {
    const prompt = buildChatPrompt(context, q, intent);
    answer = await callGeminiText(prompt, { temperature: 0.45 });
  }

  return {
    answer,
    focus_domains: gameFocusDomains || [],
    child_name: context.child.full_name,
    age_months: context.child.age_months,
    personalized_games: intent.requestGames,
    intent: intent.primary,
    out_of_scope: false,
  };
}
