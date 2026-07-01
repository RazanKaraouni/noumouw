import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import {
  createOrUpdateUser,
  deleteUser,
  getParentChildren,
  listUsers,
  reactivateParent,
  suspendParent,
} from '../controllers/userController.js';

const router = express.Router();

router.post('/', createOrUpdateUser);

router.get('/', ...authenticateAdmin, listUsers);
router.get('/:parent_id/children', ...authenticateAdmin, getParentChildren);
router.patch('/:parent_id/suspend', ...authenticateAdmin, suspendParent);
router.patch('/:parent_id/reactivate', ...authenticateAdmin, reactivateParent);
router.delete('/:parent_id', ...authenticateAdmin, deleteUser);

export default router;
