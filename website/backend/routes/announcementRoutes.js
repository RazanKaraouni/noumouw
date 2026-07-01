import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import {
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  listAdminAnnouncements,
} from '../controllers/announcementController.js';

const router = express.Router();

router.use(...authenticateAdmin);
router.get('/', listAdminAnnouncements);
router.post('/', createAdminAnnouncement);
router.delete('/:announcementId', deleteAdminAnnouncement);

export default router;
