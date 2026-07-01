import express from 'express';
import { authenticateTherapist } from '../middleware/auth.js';
import {
  changeTherapistPassword,
  getTherapistProfile,
  resendTherapistPasswordChangeOtp,
  sendTherapistPasswordChangeOtp,
  updateTherapistProfile,
} from '../controllers/therapistAccountController.js';

const router = express.Router();

router.get('/profile', ...authenticateTherapist, getTherapistProfile);
router.patch('/profile', ...authenticateTherapist, updateTherapistProfile);
router.post('/change-password/send-otp', ...authenticateTherapist, sendTherapistPasswordChangeOtp);
router.post('/change-password/resend-otp', ...authenticateTherapist, resendTherapistPasswordChangeOtp);
router.patch('/change-password', ...authenticateTherapist, changeTherapistPassword);

export default router;
