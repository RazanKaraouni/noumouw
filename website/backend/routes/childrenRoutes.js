import express from 'express';
import { authenticateAdmin, authenticateParent } from '../middleware/auth.js';
import { listChildren, createChild, deleteChild } from '../controllers/childrenController.js';

const router = express.Router();

router.get('/', ...authenticateAdmin, listChildren);

router.post('/', ...authenticateParent, createChild);
router.delete('/:children_id', ...authenticateParent, deleteChild);

export default router;
