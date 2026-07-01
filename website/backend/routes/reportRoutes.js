import express from 'express';
import { authenticateAdmin, authenticateParent } from '../middleware/auth.js';
import {
  getChildProgressReport,
  getAdminChildProgressReport,
  postMilestoneTrackingReport,
  listAdminScreeningArchive,
  listAdminMilestoneArchive,
  backfillScreeningReportsFromFiles,
  listParentReportHistory,
} from '../controllers/ReportController.js';

const router = express.Router();

router.get('/admin/screening-archive', ...authenticateAdmin, listAdminScreeningArchive);
router.get('/admin/milestone-archive', ...authenticateAdmin, listAdminMilestoneArchive);
router.get('/admin/child/:children_id', ...authenticateAdmin, getAdminChildProgressReport);
router.post(
  '/admin/backfill-screening',
  ...authenticateAdmin,
  backfillScreeningReportsFromFiles,
);

router.post('/milestone-tracking', ...authenticateParent, postMilestoneTrackingReport);
router.get('/history', ...authenticateParent, listParentReportHistory);
router.get('/:children_id', ...authenticateParent, getChildProgressReport);

export default router;
