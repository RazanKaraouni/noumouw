import {
  ALLOWED_ASSISTANT_INTENTS,
  detectAssistantIntent,
} from './assistantIntent.js';

export const CANNOT_ANSWER_MESSAGE =
  "I can only help with your child's last therapist assignment and play activity ideas. I can't answer that.";

const CANNOT_ANSWER_MESSAGE_AR =
  'يمكنني المساعدة فقط في آخر مهمة من المعالج وأفكار الألعاب. لا أستطيع الإجابة على هذا.';

export function cannotAnswerMessageFor(question) {
  return /[\u0600-\u06FF]/.test(String(question || ''))
    ? CANNOT_ANSWER_MESSAGE_AR
    : CANNOT_ANSWER_MESSAGE;
}

const GREETING_ONLY_RE =
  /^(hi|hello|hey|thanks|thank you|thank u|ok|okay|good morning|good evening|مرحبا|مرحباً|أهلا|شكرا|شكراً|السلام عليكم)[!.?\s]*$/i;

/**
 * @returns {'greeting' | 'in_scope' | 'off_topic'}
 */
export function classifyAssistantQuestion(question) {
  const q = String(question || '').trim();
  if (!q) return 'off_topic';

  if (GREETING_ONLY_RE.test(q)) return 'greeting';

  const intent = detectAssistantIntent(q);
  if (ALLOWED_ASSISTANT_INTENTS.has(intent.primary)) return 'in_scope';

  return 'off_topic';
}

export function greetingRedirectMessage(question) {
  if (/[\u0600-\u06FF]/.test(String(question || ''))) {
    return 'يمكنني شرح آخر مهمة من المعالج أو اقتراح أفكار لعب. ماذا تريد؟';
  }
  return 'I can explain the last therapist assignment or suggest play activities. What would you like?';
}
