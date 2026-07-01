import express from 'express';
import {
  completeParentAssignment,
  listParentAssignmentsForChild,
  saveParentAssignmentNotes,
} from '../controllers/parentAssignmentsController.js';
import { authenticateParent } from '../middleware/auth.js';

const router = express.Router();

router.use(...authenticateParent);

router.get('/:child_id', listParentAssignmentsForChild);
router.patch('/notes/:assigned_activity_id', saveParentAssignmentNotes);
router.patch('/complete/:assigned_activity_id', completeParentAssignment);
router.post('/complete/:assigned_activity_id', completeParentAssignment);

export default router;
