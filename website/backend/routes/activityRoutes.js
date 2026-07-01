import express from 'express';
import {
  createActivity,
  listActivities,
  removeActivity,
  updateActivity,
} from '../controllers/activityController.js';
import { authenticateJwt } from '../middleware/auth.js';

const router = express.Router();

// PUBLIC: intentional because activity catalog is shown during onboarding before login.
router.get('/', listActivities);
router.post('/', authenticateJwt, createActivity);
router.put('/:activity_id', authenticateJwt, updateActivity);
router.delete('/:activity_id', authenticateJwt, removeActivity);

export default router;
