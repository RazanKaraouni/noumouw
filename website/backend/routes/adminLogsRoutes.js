import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import {
  listEmailBlocklist,
  listUserWarnings,
  addEmailBlocklistEntry,
  deleteEmailBlocklistEntry,
} from '../controllers/adminLogsController.js';
import { listModerationLog } from '../services/moderationAuditService.js';

const router = express.Router();

router.use(...authenticateAdmin);

router.get('/blocklist', listEmailBlocklist);
router.post('/blocklist', addEmailBlocklistEntry);
router.delete('/blocklist/:blockId', deleteEmailBlocklistEntry);

router.get('/warnings', listUserWarnings);
router.get('/moderation', listModerationLog);

export default router;
