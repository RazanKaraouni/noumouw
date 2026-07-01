import express from 'express';

import { registerDeviceToken } from '../controllers/deviceTokensController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, registerDeviceToken);

export default router;
