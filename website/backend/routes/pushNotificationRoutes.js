import express from 'express';

import { sendPushNotification } from '../controllers/pushNotificationController.js';
import { authenticateJwt, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post(
  '/send-notification',
  authenticateJwt,
  requireRole('admin', 'therapist'),
  sendPushNotification,
);

export default router;
