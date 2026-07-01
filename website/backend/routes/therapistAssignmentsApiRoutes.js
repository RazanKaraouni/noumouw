import express from 'express';
import { authenticateTherapist } from '../middleware/auth.js';
import {
  deleteTherapistAssignment,
  listTherapistAssignments,
  updateTherapistAssignment,
} from '../controllers/therapistAssignmentsController.js';

const router = express.Router();

router.get('/mine', ...authenticateTherapist, listTherapistAssignments);
router.patch('/:assignmentId', ...authenticateTherapist, updateTherapistAssignment);
router.delete('/:assignmentId', ...authenticateTherapist, deleteTherapistAssignment);

export default router;
