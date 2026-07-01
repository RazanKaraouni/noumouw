import express from 'express';
import {
  clearMyNotifications,
  listMyNotifications,
  listTherapistNotifications,
  markAllTherapistNotificationsRead,
  markTherapistNotificationRead,
} from '../controllers/notificationsController.js';
import { authenticate, requireTherapist } from '../middleware/auth.js';

const router = express.Router();

router.get('/mine', authenticate, listMyNotifications);
router.post('/clear', authenticate, clearMyNotifications);

router.get('/', authenticate, requireTherapist, listTherapistNotifications);
router.patch('/read-all', authenticate, requireTherapist, markAllTherapistNotificationsRead);
router.patch('/:id/read', authenticate, requireTherapist, markTherapistNotificationRead);

export default router;
