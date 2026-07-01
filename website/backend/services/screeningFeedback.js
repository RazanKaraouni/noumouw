/** Normalize parent feedback keyed by question_number (string). */
export function parentFeedbackByQuestion(payload) {
  const map = new Map();
  const raw = payload?.parent_question_feedback;
  if (!raw) return map;

  const rows = Array.isArray(raw) ? raw : Object.values(raw);
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const num = row.question_number ?? row.questionNumber;
    if (num == null) continue;
    map.set(String(num), {
      question_number: Number(num),
      parent_completed: row.parent_completed === true,
      parent_notes: typeof row.parent_notes === 'string' ? row.parent_notes : '',
    });
  }
  return map;
}

export function mergeResponsesWithFeedback(responses, feedbackMap) {
  const list = Array.isArray(responses) ? responses : [];
  return list.map((r) => {
    const num = r?.question_number;
    const fb = num != null ? feedbackMap.get(String(num)) : null;
    return {
      ...r,
      parent_completed: fb?.parent_completed ?? false,
      parent_notes: fb?.parent_notes ?? '',
    };
  });
}

export function upsertParentFeedback(existingPayload, { question_number, parent_completed, parent_notes }) {
  const payload = existingPayload && typeof existingPayload === 'object' ? { ...existingPayload } : {};
  const map = parentFeedbackByQuestion(payload);
  map.set(String(question_number), {
    question_number: Number(question_number),
    parent_completed: parent_completed === true,
    parent_notes: typeof parent_notes === 'string' ? parent_notes.trim() : '',
  });
  payload.parent_question_feedback = [...map.values()].sort(
    (a, b) => Number(a.question_number) - Number(b.question_number),
  );
  return payload;
}

export function reportPrimaryKey(row) {
  return row?.reports_id ?? row?.report_id ?? row?.id ?? null;
}
