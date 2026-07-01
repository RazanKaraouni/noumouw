import express from 'express';
import {
  listMilestones,
  addMilestone,
  editMilestone,
  removeMilestone,
} from '../controllers/milestoneController.js';
import { authenticateJwt, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJwt, requireRole('admin', 'therapist'));

router.get('/', listMilestones);
router.post('/', addMilestone);
router.put('/:milestones_id', editMilestone);
router.delete('/:milestones_id', removeMilestone);

export default router;
