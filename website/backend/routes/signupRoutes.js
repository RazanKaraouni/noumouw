import express from 'express';
import {
  confirmResetOtp,
  forgotPassword,
  resendOtp,
  resendResetOtp,
  resetPassword,
  signup,
  verify,
} from '../controllers/signupController.js';
import {
  resendOtpRateLimiter,
  signupRateLimiter,
  verifyOtpRateLimiter,
} from '../middleware/rateLimit.js';

const router = express.Router();

// PUBLIC: intentional because parent self-registration is unauthenticated (OTP verified separately).
router.post('/signup', signupRateLimiter, signup);
// PUBLIC: intentional because email verification completes registration before first login.
router.post('/verify', verifyOtpRateLimiter, verify);
router.post('/resend-otp', resendOtpRateLimiter, resendOtp);
router.post('/forgot-password', signupRateLimiter, forgotPassword);
router.post('/confirm-reset-otp', verifyOtpRateLimiter, confirmResetOtp);
router.post('/resend-reset-otp', resendOtpRateLimiter, resendResetOtp);
router.post('/reset-password', signupRateLimiter, resetPassword);

export default router;
