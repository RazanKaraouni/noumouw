import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import {
  getAllMasterActivities,
  createMasterActivity,
  updateMasterActivity,
  deleteMasterActivity,
  parseAgeRange,
} from '../models/masterActivityModel.js';

const DOMAINS = new Set(['cognitive', 'motor', 'social', 'language']);

function normalizePayload(body) {
  const activity_name = typeof body.activity_name === 'string' ? body.activity_name.trim() : '';
  const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
  const age_range = typeof body.age_range === 'string' ? body.age_range.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  return { activity_name, domain, age_range, description };
}

function validatePayload(payload) {
  if (!payload.activity_name) return 'activity_name is required.';
  if (!payload.domain || !DOMAINS.has(payload.domain.toLowerCase())) {
    return 'domain must be one of: Cognitive, Motor, Social, Language.';
  }
  if (!payload.age_range || !parseAgeRange(payload.age_range)) {
    return 'age_range is required (e.g. "by 2 Months").';
  }
  return null;
}

export const listMasterActivities = async (req, res) => {
  try {
    const domain = typeof req.query.domain === 'string' ? req.query.domain.trim() : '';
    const data = await getAllMasterActivities({ domain: domain || undefined });
    res.json(data);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const addMasterActivity = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const row = await createMasterActivity(payload);
    res.status(201).json(row);
  } catch (err) {
    const status = /required|Invalid|age_range/i.test(err.message) ? 400 : 500;
    sendErrorResponse(res, err, status);
  }
};

export const editMasterActivity = async (req, res) => {
  try {
    const id = req.params.master_activity_id || req.params.activity_id;
    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const row = await updateMasterActivity(id, payload);
    res.json(row);
  } catch (err) {
    const status = /required|Invalid|age_range/i.test(err.message) ? 400 : 500;
    sendErrorResponse(res, err, status);
  }
};

export const removeMasterActivity = async (req, res) => {
  try {
    const id = req.params.master_activity_id || req.params.activity_id;
    await deleteMasterActivity(id);
    res.json({ message: 'Activity deleted.' });
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};
