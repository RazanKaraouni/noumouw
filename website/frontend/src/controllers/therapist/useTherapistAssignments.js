import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useState } from 'react';
import { therapistModel } from '../../models/therapistModel.js';

/** Controller: assignments list + therapist replies. */
export function useTherapistAssignments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyDraft, setReplyDraft] = useState({});
  const [savingReplyId, setSavingReplyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await therapistModel.assignments.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getUserFacingError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveReply = async (assignmentId, currentReply) => {
    const text = (replyDraft[assignmentId] ?? currentReply ?? '').trim();
    setSavingReplyId(assignmentId);
    try {
      await therapistModel.assignments.update(assignmentId, {
        therapist_reply: text || null,
      });
      await load();
      setReplyDraft((d) => {
        const next = { ...d };
        delete next[assignmentId];
        return next;
      });
    } catch (e) {
      setError(getUserFacingError(e));
    } finally {
      setSavingReplyId(null);
    }
  };

  const needsReply = (a) =>
    Boolean(a.parent_notes?.trim()) && !a.therapist_reply?.trim();

  return {
    rows,
    loading,
    error,
    load,
    replyDraft,
    setReplyDraft,
    savingReplyId,
    saveReply,
    needsReply,
  };
}
