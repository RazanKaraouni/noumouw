import express from 'express';

import { saveDeviceToken } from '../controllers/deviceTokensController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/save-token', authenticate, saveDeviceToken);

export default router;
