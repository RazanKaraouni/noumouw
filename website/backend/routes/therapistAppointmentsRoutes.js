import express from 'express';
import {
  listMyTherapistAppointments,
  appointmentDecision,
  updateAppointmentStatus,
  getAppointmentChildPreview,
  completeAppointmentSession,
  startTherapistSession,
  deleteMyAppointment,
} from '../controllers/therapistAppointmentsController.js';
import { authenticateTherapist } from '../middleware/auth.js';

const router = express.Router();

router.use(...authenticateTherapist);

router.get('/mine', listMyTherapistAppointments);
router.patch('/:id/decision', appointmentDecision);
router.put('/:id/status', updateAppointmentStatus);
router.get('/:appointments_id/child-preview', getAppointmentChildPreview);
router.patch('/:appointmentId/start', startTherapistSession);
router.patch('/:appointmentId/complete', completeAppointmentSession);
router.delete('/:id', deleteMyAppointment);

export default router;
