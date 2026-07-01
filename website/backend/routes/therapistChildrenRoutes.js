import express from 'express';
import { authenticateTherapist } from '../middleware/auth.js';
import { listMyTherapistChildren } from '../controllers/therapistChildrenController.js';
import { getTherapistChildProfile } from '../controllers/therapistChildProfileController.js';
import { createTherapistAssignment } from '../controllers/therapistAssignmentsController.js';
import { createTherapistPrivateNote } from '../controllers/therapistPrivateNotesController.js';

const router = express.Router();

router.get('/mine', ...authenticateTherapist, listMyTherapistChildren);
router.get('/:childId/profile', ...authenticateTherapist, getTherapistChildProfile);
router.post('/:childId/assignments', ...authenticateTherapist, createTherapistAssignment);
router.post('/:childId/private-notes', ...authenticateTherapist, createTherapistPrivateNote);

export default router;
