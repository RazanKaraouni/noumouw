import {
  getAllMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '../models/milestoneModel.js';
import { labelForAgeBounds } from '../utils/cdcMilestoneAgeTiers.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

function withAgeRangeLabel(row) {
  if (!row || typeof row !== 'object') return row;
  const min = Number(row.age_months_min);
  const max = Number(row.age_months_max);
  const stored =
    typeof row.age_range === 'string' && row.age_range.trim() ? row.age_range.trim() : '';
  return {
    ...row,
    age_range:
      stored ||
      (Number.isFinite(min) && Number.isFinite(max) ? labelForAgeBounds(min, max) : ''),
  };
}

export const listMilestones = async (req, res) => {
  try {
    const domain = typeof req.query.domain === 'string' ? req.query.domain.trim().toLowerCase() : '';
    const data = await getAllMilestones({ domain: domain || undefined });
    res.json((data || []).map(withAgeRangeLabel));
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const addMilestone = async (req, res) => {
  try {
    const { title, description, age_months_min, age_months_max, domain, age_range } = req.body;
    if (!title || !domain || age_months_min === undefined || age_months_max === undefined)
      return res.status(400).json({
        message: 'title, domain, age_months_min and age_months_max are required.',
      });

    const min = Number(age_months_min);
    const max = Number(age_months_max);
    const storedAgeRange =
      typeof age_range === 'string' && age_range.trim()
        ? age_range.trim()
        : labelForAgeBounds(min, max);
    const milestone = await createMilestone({
      title,
      description,
      domain: String(domain).trim().toLowerCase(),
      age_months_min: min,
      age_months_max: max,
      age_range: storedAgeRange,
    });
    res.status(201).json(withAgeRangeLabel(milestone));
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const editMilestone = async (req, res) => {
  try {
    const milestonesId = req.params.milestones_id || req.params.id;
    const { title, description, age_months_min, age_months_max, domain, age_range } = req.body;
    const min = Number(age_months_min);
    const max = Number(age_months_max);
    const updates = {
      title,
      description,
      age_months_min: min,
      age_months_max: max,
    };
    if (domain != null) updates.domain = String(domain).trim().toLowerCase();
    if (typeof age_range === 'string' && age_range.trim()) {
      updates.age_range = age_range.trim();
    } else if (Number.isFinite(min) && Number.isFinite(max)) {
      updates.age_range = labelForAgeBounds(min, max);
    }
    const milestone = await updateMilestone(milestonesId, updates);
    res.json(withAgeRangeLabel(milestone));
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const removeMilestone = async (req, res) => {
  try {
    const milestonesId = req.params.milestones_id || req.params.id;
    await deleteMilestone(milestonesId);
    res.json({ message: 'Milestone deleted.' });
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};
