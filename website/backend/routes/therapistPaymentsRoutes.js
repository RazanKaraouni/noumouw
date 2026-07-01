import express from 'express';
import {
  listTherapistPayments,
} from '../controllers/paymentController.js';
import { authenticateTherapist } from '../middleware/auth.js';

const router = express.Router();

router.use(...authenticateTherapist);
router.get('/mine', listTherapistPayments);

export default router;
