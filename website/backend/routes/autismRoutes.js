import express from 'express';
import {
  authenticateJwt,
  authenticateParent,
  requireRole,
} from '../middleware/auth.js';
import {
  listAutismQuestions,
  createAutismQuestion,
  editAutismQuestion,
  deleteAutismQuestion,
  submitAutismScreening,
  getAutismScreeningReport,
  updateScreeningQuestionFeedback,
} from '../controllers/autismController.js';

const router = express.Router();

router.post('/submit', ...authenticateParent, submitAutismScreening);
router.get('/report/:children_id', ...authenticateParent, getAutismScreeningReport);
router.patch(
  '/report/:children_id/feedback',
  ...authenticateParent,
  updateScreeningQuestionFeedback,
);

const authenticateContentManager = [authenticateJwt, requireRole('admin', 'therapist')];

router.post('/questions', ...authenticateContentManager, createAutismQuestion);
router.get('/questions', ...authenticateContentManager, listAutismQuestions);
router.put('/questions/:autism_qs_id', ...authenticateContentManager, editAutismQuestion);
router.delete('/questions/:autism_qs_id', ...authenticateContentManager, deleteAutismQuestion);

export default router;
