import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import {
  createAdminTherapist,
  deleteAdminTherapist,
  getTherapistStatsHandler,
  listAdminTherapists,
  listSpecializations,
  reactivateAdminTherapist,
  suspendAdminTherapist,
  updateAdminTherapist,
} from '../controllers/adminTherapistController.js';

const router = Router();

router.get('/specializations', ...authenticateAdmin, listSpecializations);
router.get('/stats', ...authenticateAdmin, getTherapistStatsHandler);

router.get('/', ...authenticateAdmin, listAdminTherapists);
router.post('/', ...authenticateAdmin, createAdminTherapist);
router.put('/:therapist_id', ...authenticateAdmin, updateAdminTherapist);
router.patch('/:therapist_id/suspend', ...authenticateAdmin, suspendAdminTherapist);
router.patch('/:therapist_id/reactivate', ...authenticateAdmin, reactivateAdminTherapist);
router.delete('/:therapist_id', ...authenticateAdmin, deleteAdminTherapist);

export default router;
