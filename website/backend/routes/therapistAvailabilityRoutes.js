import express from 'express';
import { authenticateTherapist } from '../middleware/auth.js';
import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  listMyAvailability,
  updateAvailabilitySlot,
} from '../controllers/therapistAvailabilityController.js';

const router = express.Router();

router.post('/', ...authenticateTherapist, createAvailabilitySlot);
router.get('/mine', ...authenticateTherapist, listMyAvailability);
router.patch('/:availability_id', ...authenticateTherapist, updateAvailabilitySlot);
router.delete('/:availability_id', ...authenticateTherapist, deleteAvailabilitySlot);

export default router;
