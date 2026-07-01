import express from 'express';
import { authenticateTherapist } from '../middleware/auth.js';
import {
  deleteTherapistPrivateNote,
  updateTherapistPrivateNote,
} from '../controllers/therapistPrivateNotesController.js';

const router = express.Router();

router.patch('/:noteId', ...authenticateTherapist, updateTherapistPrivateNote);
router.delete('/:noteId', ...authenticateTherapist, deleteTherapistPrivateNote);

export default router;
