import express from 'express';
import {
  bookAppointment,
  getAllAvailabilitySlots,
  getAllAvailableDatesSummary,
  getAvailabilitySlots,
  getAvailableDatesSummary,
  getParentAppointmentById,
  listParentAppointments,
  requestParentAppointmentCancellation,
  updateParentAppointment,
} from '../controllers/bookingController.js';
import {
  getParentPaymentForAppointment,
  listParentPayments,
  payParentSession,
} from '../controllers/paymentController.js';
import { authenticateParent } from '../middleware/auth.js';

const router = express.Router();

// PUBLIC: intentional because parents browse open slots before authenticating to book.
router.get('/availability', getAvailabilitySlots);
router.get('/availability-all', getAllAvailabilitySlots);
router.get('/available-dates', getAvailableDatesSummary);
router.get('/available-dates-all', getAllAvailableDatesSummary);
router.get('/appointments', ...authenticateParent, listParentAppointments);
router.get(
  '/appointments/:appointmentsId',
  ...authenticateParent,
  getParentAppointmentById,
);
router.post('/appointments', ...authenticateParent, bookAppointment);
router.patch('/appointments/:appointmentsId', ...authenticateParent, updateParentAppointment);
router.patch(
  '/appointments/:appointmentsId/cancel-request',
  ...authenticateParent,
  requestParentAppointmentCancellation,
);

router.get('/payments', ...authenticateParent, listParentPayments);
router.get(
  '/payments/:appointmentId',
  ...authenticateParent,
  getParentPaymentForAppointment,
);
router.post(
  '/payments/:appointmentId/pay',
  ...authenticateParent,
  payParentSession,
);

export default router;
