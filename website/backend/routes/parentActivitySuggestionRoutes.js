import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateParent } from '../middleware/auth.js';
import {
  chatWithParentAssistant,
  explainAssignmentForParent,
  suggestActivityForParent,
} from '../controllers/activitySuggestionController.js';

const router = Router();

const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many activity requests. Please try again in a minute.' },
});

router.post('/chat', ...authenticateParent, suggestLimiter, chatWithParentAssistant);
router.post('/suggest', ...authenticateParent, suggestLimiter, suggestActivityForParent);
router.post(
  '/explain-assignment',
  ...authenticateParent,
  suggestLimiter,
  explainAssignmentForParent,
);

export default router;
