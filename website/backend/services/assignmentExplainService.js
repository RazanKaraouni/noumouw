import supabase from '../config/supabase.js';
import { assertParentOwnsChild } from './activitySuggestionContextService.js';
import { ageMonthsFromDateOfBirth } from '../utils/childAge.js';
import { callGeminiText } from './geminiClient.js';
import {
  cannotAnswerMessageFor,
  classifyAssistantQuestion,
} from '../utils/assistantQuestionScope.js';
import { SHORT_ANSWER_RULES } from '../utils/assistantIntent.js';
import {
  assignmentArabicInstruction,
  isArabicText,
  replyLanguageInstruction,
} from '../utils/assistantLanguage.js';

async function loadAssignmentsWithTherapists(childId) {
  const { data, error } = await supabase
    .from('assignments')
    .select(
      'assignment_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at, therapist_id',
    )
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  const therapistIds = [
    ...new Set((data || []).map((a) => a.therapist_id).filter(Boolean)),
  ];
  let nameByTherapist = new Map();
  if (therapistIds.length) {
    const therapists = await supabase
      .from('therapists')
      .select('therapist_id, full_name')
      .in('therapist_id', therapistIds);
    if (therapists.error) throw therapists.error;
    nameByTherapist = new Map(
      (therapists.data || []).map((t) => [t.therapist_id, t.full_name]),
    );
  }

  return (data || []).map((row) => ({
    assignment_id: row.assignment_id,
    title: row.title,
    description: row.description,
    domain: row.domain,
    status: row.status,
    parent_notes: row.parent_notes,
    therapist_reply: row.therapist_reply,
    due_date: row.due_date,
    priority: row.priority,
    created_at: row.created_at,
    therapist_name: nameByTherapist.get(row.therapist_id) || 'Therapist',
  }));
}

function formatAssignmentsForPrompt(assignments) {
  return assignments
    .map((a, i) => {
      const parts = [
        `${i + 1}. Title: ${a.title}`,
        `   Therapist: ${a.therapist_name}`,
        `   Domain: ${a.domain || 'general'}`,
        `   Status: ${a.status}`,
        `   Priority: ${a.priority || 'medium'}`,
      ];
      if (a.due_date) parts.push(`   Due: ${a.due_date}`);
      if (a.description) parts.push(`   Instructions: ${a.description}`);
      if (a.therapist_reply) parts.push(`   Therapist note: ${a.therapist_reply}`);
      if (a.parent_notes) parts.push(`   Parent notes: ${a.parent_notes}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

/**
 * Explain therapist-assigned activities for a parent using Gemini.
 */
export async function explainTherapistAssignments(parentUserId, childId, userQuestion) {
  const question = String(userQuestion || '').trim();
  const scope = classifyAssistantQuestion(question);
  if (scope === 'off_topic') {
    return {
      explanation: cannotAnswerMessageFor(question),
      assignment_count: 0,
      out_of_scope: true,
    };
  }

  const child = await assertParentOwnsChild(parentUserId, childId);
  const ageMonths = ageMonthsFromDateOfBirth(child.date_of_birth) ?? 0;
  const assignments = await loadAssignmentsWithTherapists(childId);

  if (!assignments.length) {
    return {
      explanation: isArabicText(question)
        ? 'لم يُعيّن المعالج أي نشاط بعد. ستظهر هنا عند التعيين.'
        : "Your therapist hasn't assigned any activities yet. You'll see them here once they do.",
      assignment_count: 0,
    };
  }

  const promptQuestion =
    question || 'Please explain my therapist assignments.';
  const newest = assignments[0];
  const newestBlock = newest
    ? `NEWEST THERAPIST ASSIGNMENT (explain this one unless parent names another):
Title: ${newest.title}
Domain: ${newest.domain || 'general'}
Status: ${newest.status}
Therapist: ${newest.therapist_name}
${newest.due_date ? `Due: ${newest.due_date}\n` : ''}${newest.description ? `Instructions: ${newest.description}\n` : ''}${newest.therapist_reply ? `Therapist note: ${newest.therapist_reply}` : ''}`
    : 'No assignments yet.';

  const prompt = `You are a warm parenting assistant for Noumouw.

${SHORT_ANSWER_RULES}

${replyLanguageInstruction(promptQuestion)}

${assignmentArabicInstruction(promptQuestion)}

CHILD: ${child.full_name || 'Child'} (${ageMonths} months old)

NOTE: Assignment data below may be in English — if the parent wrote in Arabic, translate and explain everything in Arabic.

${newestBlock}

ALL THERAPIST ASSIGNMENTS:
${formatAssignmentsForPrompt(assignments)}

PARENT'S QUESTION:
"${promptQuestion}"

Reply in plain text (no JSON).
Include briefly:
1) What to do (newest assignment unless they named another)
2) Which domain/skill it helps (one line)
3) Up to 3 short numbered steps at home
4) One quick tip (time or success sign)

Max 120 words. If no assignment, say so in one line and suggest one brief game.`;

  const explanation = await callGeminiText(prompt, { temperature: 0.45 });

  return {
    explanation,
    assignment_count: assignments.length,
    child_name: child.full_name,
  };
}
