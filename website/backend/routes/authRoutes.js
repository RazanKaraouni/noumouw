import express from 'express';
import { login, parentLogin } from '../controllers/authController.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
// PUBLIC: intentional because portal login must work without a prior session.
router.post('/login', loginRateLimiter, login);
router.post('/parent-login', loginRateLimiter, parentLogin);

export default router;

