import supabase from '../config/supabase.js';
import { getParentSupabase } from '../utils/supabaseForRequest.js';
import { getParentUserId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import {
  sendNotification,
  THERAPIST_NOTIFICATION_TYPES,
} from '../services/notificationService.js';

async function assertParentOwnsChild(req, parentUserId, childId) {
  const db = getParentSupabase(req);
  const row = await db
    .from('children')
    .select('children_id')
    .eq('children_id', childId)
    .eq('parent_id', parentUserId)
    .maybeSingle();
  if (row.error) throw row.error;
  if (!row.data) {
    const err = new Error('Child not found.');
    err.status = 404;
    throw err;
  }
}

function mapAssignmentRow(row, therapistName) {
  const id = row.assignment_id;
  return {
    assigned_activity_id: id,
    assignment_id: id,
    child_id: row.child_id,
    activity_title: row.title,
    title: row.title,
    description: row.description,
    domain: row.domain,
    status: row.status,
    parent_notes: row.parent_notes,
    therapist_reply: row.therapist_reply,
    therapist_name: therapistName ?? 'Therapist',
    due_date: row.due_date,
    priority: row.priority,
    created_at: row.created_at,
  };
}

export async function listParentAssignmentsForChild(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    const childId = Number(req.params.child_id);
    if (!Number.isFinite(childId)) {
      return res.status(400).json({ message: 'Invalid child id.' });
    }
    await assertParentOwnsChild(req, parentUserId, childId);

    const db = getParentSupabase(req);
    const { data, error } = await db
      .from('assignments')
      .select(
        'assignment_id, child_id, therapist_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at',
      )
      .eq('child_id', childId)
      .order('created_at', { ascending: false });
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

    const rows = (data || []).map((a) =>
      mapAssignmentRow(a, nameByTherapist.get(a.therapist_id)),
    );
    return res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}

export async function completeParentAssignment(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    const assignedActivityId = String(
      req.params.assigned_activity_id || req.params.assignment_id || '',
    ).trim();
    if (!assignedActivityId) {
      return res.status(400).json({ message: 'assigned_activity_id is required.' });
    }

    const db = getParentSupabase(req);
    const existing = await db
      .from('assignments')
      .select('assignment_id, child_id, status')
      .eq('assignment_id', assignedActivityId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    await assertParentOwnsChild(req, parentUserId, existing.data.child_id);

    if (existing.data.status === 'completed') {
      return res.json({
        assigned_activity_id: assignedActivityId,
        status: 'completed',
      });
    }

    const upd = await db
      .from('assignments')
      .update({ status: 'completed' })
      .eq('assignment_id', assignedActivityId)
      .select(
        'assignment_id, child_id, therapist_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at',
      )
      .maybeSingle();
    if (upd.error) throw upd.error;
    if (!upd.data) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    try {
      const assignmentTitle = (upd.data.title || 'Assignment').trim();
      await sendNotification({
        recipientId: upd.data.therapist_id,
        senderId: parentUserId,
        type: THERAPIST_NOTIFICATION_TYPES.ASSIGNMENT_DONE,
        title: 'Assignment completed',
        message: `A parent marked "${assignmentTitle}" as done.`,
      });
    } catch (notifErr) {
      console.error('[completeParentAssignment] sendNotification:', notifErr?.message || notifErr);
    }

    const therapistRes = await supabase
      .from('therapists')
      .select('full_name')
      .eq('therapist_id', upd.data.therapist_id)
      .maybeSingle();
    if (therapistRes.error) throw therapistRes.error;

    return res.json(mapAssignmentRow(upd.data, therapistRes.data?.full_name));
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}

export async function saveParentAssignmentNotes(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    const assignedActivityId = String(
      req.params.assigned_activity_id || req.params.assignment_id || '',
    ).trim();
    if (!assignedActivityId) {
      return res.status(400).json({ message: 'assigned_activity_id is required.' });
    }

    const notesRaw = req.body?.parent_notes ?? req.body?.notes;
    const trimmed =
      notesRaw == null || notesRaw === '' ? null : String(notesRaw).trim() || null;

    const db = getParentSupabase(req);
    const existing = await db
      .from('assignments')
      .select('assignment_id, child_id, therapist_id, title, parent_notes')
      .eq('assignment_id', assignedActivityId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    await assertParentOwnsChild(req, parentUserId, existing.data.child_id);

    const previousNotes = (existing.data.parent_notes || '').trim();
    if (trimmed === previousNotes) {
      const therapistRes = await supabase
        .from('therapists')
        .select('full_name')
        .eq('therapist_id', existing.data.therapist_id)
        .maybeSingle();
      if (therapistRes.error) throw therapistRes.error;
      return res.json(mapAssignmentRow(existing.data, therapistRes.data?.full_name));
    }

    const upd = await db
      .from('assignments')
      .update({ parent_notes: trimmed })
      .eq('assignment_id', assignedActivityId)
      .select(
        'assignment_id, child_id, therapist_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at',
      )
      .maybeSingle();
    if (upd.error) throw upd.error;
    if (!upd.data) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    if (trimmed) {
      try {
        const assignmentTitle = (upd.data.title || 'Assignment').trim();
        const snippet = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
        await sendNotification({
          recipientId: upd.data.therapist_id,
          senderId: parentUserId,
          type: THERAPIST_NOTIFICATION_TYPES.ASSIGNMENT_NOTE,
          title: 'New assignment note',
          message: `Note on "${assignmentTitle}": ${snippet}`,
        });
      } catch (notifErr) {
        console.error('[saveParentAssignmentNotes] sendNotification:', notifErr?.message || notifErr);
      }
    }

    const therapistRes = await supabase
      .from('therapists')
      .select('full_name')
      .eq('therapist_id', upd.data.therapist_id)
      .maybeSingle();
    if (therapistRes.error) throw therapistRes.error;

    return res.json(mapAssignmentRow(upd.data, therapistRes.data?.full_name));
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}
