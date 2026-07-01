import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import {
  deleteAdminCommunityComment,
  deleteAdminCommunityPost,
  getAdminCommunityPostDetail,
  listAdminCommunityPosts,
  suspendCommunityUser,
  warnCommunityUser,
} from '../controllers/adminCommunityController.js';

const router = express.Router();

router.use(...authenticateAdmin);

router.get('/posts', listAdminCommunityPosts);
router.get('/posts/:postId', getAdminCommunityPostDetail);
router.delete('/posts/:postId', deleteAdminCommunityPost);
router.delete('/comments/:commentId', deleteAdminCommunityComment);
router.post('/users/:userId/warn', warnCommunityUser);
router.post('/users/:userId/suspend', suspendCommunityUser);

export default router;
