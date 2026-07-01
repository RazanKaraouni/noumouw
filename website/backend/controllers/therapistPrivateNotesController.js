import supabase from '../config/supabase.js';
import { getTherapistId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

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

export async function createTherapistPrivateNote(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const childId = Number(req.params.childId);
    if (!Number.isFinite(childId)) {
      return res.status(400).json({ message: 'Invalid child id.' });
    }
    await assertCaseloadChild(therapistId, childId);

    const note = String(req.body?.note || '').trim();
    const appointmentId = req.body?.appointment_id
      ? String(req.body.appointment_id).trim()
      : null;
    if (!note) {
      return res.status(400).json({ message: 'note is required.' });
    }

    const payload = {
      therapist_id: therapistId,
      child_id: childId,
      note,
    };
    if (appointmentId) {
      const ap = await supabase
        .from('appointments')
        .select('appointments_id')
        .eq('appointments_id', appointmentId)
        .eq('therapist_id', therapistId)
        .eq('child_id', childId)
        .maybeSingle();
      if (ap.error) throw ap.error;
      if (!ap.data) {
        return res.status(400).json({ message: 'appointment_id does not match this child.' });
      }
      payload.appointment_id = appointmentId;
    }

    const ins = await supabase
      .from('therapist_private_notes')
      .insert(payload)
      .select(
        'therapist_private_note_id, note, appointment_id, child_id, created_at, updated_at',
      )
      .maybeSingle();
    if (ins.error) throw ins.error;
    return res.status(201).json(ins.data);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}

export async function updateTherapistPrivateNote(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const noteId = String(req.params.noteId || '').trim();
    if (!noteId) return res.status(400).json({ message: 'note id is required.' });

    const noteText = String(req.body?.note || '').trim();
    if (!noteText) {
      return res.status(400).json({ message: 'note is required.' });
    }

    const upd = await supabase
      .from('therapist_private_notes')
      .update({ note: noteText, updated_at: new Date().toISOString() })
      .eq('therapist_private_note_id', noteId)
      .eq('therapist_id', therapistId)
      .select(
        'therapist_private_note_id, note, appointment_id, child_id, created_at, updated_at',
      )
      .maybeSingle();
    if (upd.error) throw upd.error;
    if (!upd.data) return res.status(404).json({ message: 'Note not found.' });
    return res.json(upd.data);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}

export async function deleteTherapistPrivateNote(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const noteId = String(req.params.noteId || '').trim();
    if (!noteId) return res.status(400).json({ message: 'note id is required.' });

    const del = await supabase
      .from('therapist_private_notes')
      .delete()
      .eq('therapist_private_note_id', noteId)
      .eq('therapist_id', therapistId)
      .select('therapist_private_note_id')
      .maybeSingle();
    if (del.error) throw del.error;
    if (!del.data) return res.status(404).json({ message: 'Note not found.' });
    return res.json({ ok: true, therapist_private_note_id: noteId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}
