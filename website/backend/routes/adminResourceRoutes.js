import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import {
  deleteAdminResource,
  listAdminResources,
  setAdminResourcePublic,
} from '../controllers/adminResourceController.js';

const router = express.Router();

router.use(...authenticateAdmin);
router.get('/', listAdminResources);
router.patch('/:id/public', setAdminResourcePublic);
router.delete('/:id', deleteAdminResource);

export default router;
