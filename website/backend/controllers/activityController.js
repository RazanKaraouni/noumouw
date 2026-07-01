import {
  createActivityInLibrary,
  deleteActivityById,
  getAllActivities,
  updateActivityById,
} from '../models/activityModel.js';
import { isTherapist } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

function canManageActivities(req) {
  return isTherapist(req) || req.auth?.role === 'admin';
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const listActivities = async (req, res) => {
  try {
    const domain =
      typeof req.query.domain === 'string' ? req.query.domain.trim() : '';
    const rawAge = req.query.child_age_months;
    const childAgeMonths =
      rawAge !== undefined && rawAge !== '' && Number.isFinite(Number(rawAge))
        ? Math.floor(Number(rawAge))
        : undefined;
    const data = await getAllActivities({
      domain: domain || undefined,
      childAgeMonths,
    });
    res.json(data);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const createActivity = async (req, res) => {
  try {
    if (!canManageActivities(req)) {
      return res.status(403).json({ message: 'Not authorized to create activities.' });
    }
    const body = req.body || {};
    const data = await createActivityInLibrary({
      title: body.title,
      instructions: body.instructions ?? body.description,
      domain: body.domain,
      min_age_months: body.min_age_months ?? body.age_months_min,
      max_age_months: body.max_age_months ?? body.age_months_max,
    });
    return res.status(201).json(data);
  } catch (err) {
    const raw = String(err?.message || '');
    const status = /required|Invalid|must be/i.test(raw) ? 400 : 500;
    return res.status(status).json({ message: userFacingErrorMessage(err) });
  }
};

export const updateActivity = async (req, res) => {
  try {
    if (!canManageActivities(req)) {
      return res.status(403).json({ message: 'Not authorized to update activities.' });
    }

    const activityId = req.params.activity_id || req.params.id;
    if (!activityId) {
      return res.status(400).json({ message: 'activity_id is required.' });
    }
    if (!UUID_RE.test(String(activityId))) {
      return res.status(400).json({ message: 'Invalid activity id.' });
    }
    const body = req.body || {};
    const payload = {
      title: body.title,
      instructions: body.instructions ?? body.description,
      domain: body.domain,
      min_age_months: body.min_age_months ?? body.age_months_min,
      max_age_months: body.max_age_months ?? body.age_months_max,
    };
    const data = await updateActivityById(activityId, payload);
    if (!data) {
      return res.status(404).json({ message: 'Activity not found.' });
    }
    return res.json(data);
  } catch (err) {
    const raw = String(err?.message || '');
    const status = /required|Invalid|No fields/i.test(raw) ? 400 : 500;
    return res.status(status).json({ message: userFacingErrorMessage(err) });
  }
};

export const removeActivity = async (req, res) => {
  try {
    if (!canManageActivities(req)) {
      return res.status(403).json({ message: 'Not authorized to delete activities.' });
    }

    const activityId = req.params.activity_id || req.params.id;
    if (!activityId) {
      return res.status(400).json({ message: 'activity_id is required.' });
    }
    if (!UUID_RE.test(String(activityId))) {
      return res.status(400).json({ message: 'Invalid activity id.' });
    }
    const ok = await deleteActivityById(activityId);
    if (!ok) {
      return res.status(404).json({ message: 'Activity not found.' });
    }
    return res.json({ ok: true, activity_id: activityId });
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};
