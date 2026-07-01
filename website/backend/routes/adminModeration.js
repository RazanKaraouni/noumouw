import express from 'express';
import { authenticate, authenticateAdmin } from '../middleware/auth.js';
import {
  listPendingReports,
  listResourceReports,
  resolveResourceReport,
  submitResourceReport,
  suspendUserAccount,
} from '../controllers/adminModerationController.js';

const router = express.Router();

router.post('/reports/submit', authenticate, submitResourceReport);

router.get('/reports', ...authenticateAdmin, listResourceReports);
router.get('/reports/pending', ...authenticateAdmin, listPendingReports);
router.patch('/reports/:reportId/resolve', ...authenticateAdmin, resolveResourceReport);
router.post('/users/:userId/suspend-account', ...authenticateAdmin, suspendUserAccount);

export default router;
