import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import {
  addMasterActivity,
  editMasterActivity,
  listMasterActivities,
  removeMasterActivity,
} from '../controllers/masterActivityController.js';

const router = express.Router();

router.use(...authenticateAdmin);

router.get('/', listMasterActivities);
router.post('/', addMasterActivity);
router.put('/:master_activity_id', editMasterActivity);
router.delete('/:master_activity_id', removeMasterActivity);

export default router;
