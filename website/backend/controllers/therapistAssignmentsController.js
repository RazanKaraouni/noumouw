import supabase from '../config/supabase.js';
import { getTherapistId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { notifyParent } from '../services/notificationService.js';

const DOMAINS = new Set(['speech', 'cognitive', 'motor', 'social']);
const STATUSES = new Set(['pending', 'completed', 'incomplete']);
const PRIORITIES = new Set(['low', 'medium', 'high']);

export async function listTherapistAssignments(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const { data: links, error: linkErr } = await supabase
      .from('therapist_children')
      .select('child_id')
      .eq('therapist_id', therapistId);
    if (linkErr) throw linkErr;
    const childIds = [...new Set((links || []).map((l) => l.child_id))];
    if (!childIds.length) return res.json([]);

    const { data, error } = await supabase
      .from('assignments')
      .select(
        'assignment_id, child_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at',
      )
      .eq('therapist_id', therapistId)
      .in('child_id', childIds)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: children } = await supabase
      .from('children')
      .select('children_id, full_name')
      .in('children_id', childIds);
    const nameById = new Map((children || []).map((c) => [c.children_id, c.full_name]));

    const rows = (data || []).map((a) => ({
      ...a,
      child_name: nameById.get(a.child_id) ?? '—',
    }));
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}

async function assertCaseloadChild(therapistId, childId) {
  const link = await supabase
    .from('therapist_children')
    .select('id')
    .eq('therapist_id', therapistId)
    .eq('child_id', childId)
    .maybeSingle();
  if (link.error) throw link.error;
  if (!link.data) {
    const err = new Error('Child is not in your caseload.');
    err.status = 403;
    throw err;
  }
}

async function loadAssignmentForTherapist(therapistId, assignmentId) {
  const row = await supabase
    .from('assignments')
    .select('assignment_id, therapist_id, child_id')
    .eq('assignment_id', assignmentId)
    .maybeSingle();
  if (row.error) throw row.error;
  if (!row.data || String(row.data.therapist_id) !== String(therapistId)) {
    const err = new Error('Assignment not found.');
    err.status = 404;
    throw err;
  }
  return row.data;
}

export async function createTherapistAssignment(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const childId = Number(req.params.childId);
    if (!Number.isFinite(childId)) {
      return res.status(400).json({ message: 'Invalid child id.' });
    }
    await assertCaseloadChild(therapistId, childId);

    const title = String(req.body?.title || '').trim();
    const description =
      req.body?.description == null ? null : String(req.body.description).trim() || null;
    const domain = String(req.body?.domain || '').trim().toLowerCase();
    const priority = String(req.body?.priority || 'medium').trim().toLowerCase();
    const dueRaw = req.body?.due_date;
    const due_date =
      dueRaw == null || dueRaw === '' ? null : String(dueRaw).slice(0, 10);

    if (!title) {
      return res.status(400).json({ message: 'title is required.' });
    }
    if (!DOMAINS.has(domain)) {
      return res.status(400).json({ message: 'domain must be speech, cognitive, motor, or social.' });
    }
    if (!PRIORITIES.has(priority)) {
      return res.status(400).json({ message: 'priority must be low, medium, or high.' });
    }

    const ins = await supabase
      .from('assignments')
      .insert({
        child_id: childId,
        therapist_id: therapistId,
        title,
        description,
        domain,
        priority,
        due_date,
        status: 'pending',
      })
      .select(
        'assignment_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at',
      )
      .maybeSingle();

    if (ins.error) throw ins.error;

    try {
      const [childRow, therapistRow] = await Promise.all([
        supabase
          .from('children')
          .select('parent_id, full_name')
          .eq('children_id', childId)
          .maybeSingle(),
        supabase
          .from('therapists')
          .select('full_name')
          .eq('therapist_id', therapistId)
          .maybeSingle(),
      ]);

      const parentUserId = childRow.data?.parent_id;
      if (parentUserId) {
        const childName = (childRow.data?.full_name || '').trim() || 'your child';
        const therapistName = (therapistRow.data?.full_name || '').trim() || 'Your therapist';
        await notifyParent({
          userId: parentUserId,
          assignmentId: ins.data?.assignment_id,
          type: 'assignment_created',
          title: 'New assignment',
          message: `${therapistName} assigned "${title}" to ${childName}.`,
          data: { childId: String(childId) },
        });
      }
    } catch (notifErr) {
      console.error('[createTherapistAssignment] notifyParent:', notifErr?.message || notifErr);
    }

    return res.status(201).json(ins.data);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}

export async function updateTherapistAssignment(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const assignmentId = String(req.params.assignmentId || '').trim();
    if (!assignmentId) {
      return res.status(400).json({ message: 'assignment_id is required.' });
    }
    await loadAssignmentForTherapist(therapistId, assignmentId);

    const patch = {};
    if (req.body.title !== undefined) {
      const t = String(req.body.title || '').trim();
      if (!t) return res.status(400).json({ message: 'title cannot be empty.' });
      patch.title = t;
    }
    if (req.body.description !== undefined) {
      patch.description =
        req.body.description == null ? null : String(req.body.description).trim() || null;
    }
    if (req.body.domain !== undefined) {
      const d = String(req.body.domain || '').trim().toLowerCase();
      if (!DOMAINS.has(d)) {
        return res.status(400).json({ message: 'Invalid domain.' });
      }
      patch.domain = d;
    }
    if (req.body.status !== undefined) {
      const s = String(req.body.status || '').trim().toLowerCase();
      if (!STATUSES.has(s)) {
        return res.status(400).json({ message: 'Invalid status.' });
      }
      patch.status = s;
    }
    if (req.body.therapist_reply !== undefined) {
      patch.therapist_reply =
        req.body.therapist_reply == null
          ? null
          : String(req.body.therapist_reply).trim() || null;
    }
    if (req.body.due_date !== undefined) {
      const dueRaw = req.body.due_date;
      patch.due_date =
        dueRaw == null || dueRaw === '' ? null : String(dueRaw).slice(0, 10);
    }
    if (req.body.priority !== undefined) {
      const p = String(req.body.priority || '').trim().toLowerCase();
      if (!PRIORITIES.has(p)) {
        return res.status(400).json({ message: 'Invalid priority.' });
      }
      patch.priority = p;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updates provided.' });
    }

    const upd = await supabase
      .from('assignments')
      .update(patch)
      .eq('assignment_id', assignmentId)
      .eq('therapist_id', therapistId)
      .select(
        'assignment_id, title, description, domain, status, parent_notes, therapist_reply, due_date, priority, created_at',
      )
      .maybeSingle();
    if (upd.error) throw upd.error;
    if (!upd.data) return res.status(404).json({ message: 'Assignment not found.' });

    return res.json(upd.data);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}

export async function deleteTherapistAssignment(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const assignmentId = String(req.params.assignmentId || '').trim();
    if (!assignmentId) {
      return res.status(400).json({ message: 'assignment_id is required.' });
    }
    await loadAssignmentForTherapist(therapistId, assignmentId);

    const del = await supabase
      .from('assignments')
      .delete()
      .eq('assignment_id', assignmentId)
      .eq('therapist_id', therapistId)
      .select('assignment_id')
      .maybeSingle();
    if (del.error) throw del.error;
    if (!del.data) return res.status(404).json({ message: 'Assignment not found.' });
    return res.json({ ok: true, assignment_id: assignmentId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}
