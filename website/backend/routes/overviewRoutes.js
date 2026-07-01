import { Router } from 'express';
import { listAdminAppointmentsOversight } from '../controllers/adminAppointmentsController.js';
import { getAdminOverview, getTherapistOverviewStats } from '../controllers/overviewController.js';
import { listAdminPayments, patchAdminPayment } from '../controllers/paymentController.js';
import { authenticate, requireTherapist, authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/overview', ...authenticateAdmin, getAdminOverview);
router.get('/appointments', ...authenticateAdmin, listAdminAppointmentsOversight);
router.get('/payments', ...authenticateAdmin, listAdminPayments);
router.patch('/payments/:paymentId', ...authenticateAdmin, patchAdminPayment);
router.get('/therapist/overview', authenticate, requireTherapist, getTherapistOverviewStats);

export default router;
