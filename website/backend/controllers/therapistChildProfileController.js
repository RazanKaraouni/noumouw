import supabase from '../config/supabase.js';
import { getTherapistId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { loadTherapistChildBundle } from '../services/therapistChildBundleService.js';

export async function getTherapistChildProfile(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const childId = Number(req.params.childId ?? req.params.children_id);
    if (!Number.isFinite(childId)) {
      return res.status(400).json({ message: 'Invalid child id.' });
    }

    const linkRes = await supabase
      .from('therapist_children')
      .select('id, therapist_id, child_id, parent_id, appointment_id, assigned_at')
      .eq('therapist_id', therapistId)
      .eq('child_id', childId)
      .maybeSingle();
    if (linkRes.error) throw linkRes.error;

    const bundle = await loadTherapistChildBundle({
      therapistId,
      childId,
      link: linkRes.data,
    });

    return res.json(bundle);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return sendErrorResponse(res, err, status);
  }
}
