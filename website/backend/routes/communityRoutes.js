import express from 'express';
import { authenticate, authenticateAdmin } from '../middleware/auth.js';
import {
  blockCommunityUser,
  createCommunityComment,
  createCommunityPost,
  getCommunityFeed,
  getMyCommunityPosts,
  getCommunityPost,
  getPostsByHashtag,
  getTrendingPosts,
  listCommunityComments,
  listSavedCommunityPosts,
  reportCommunityPost,
  toggleCommunityLike,
  toggleCommunitySave,
  unblockCommunityUser,
} from '../controllers/communityController.js';
import {
  listPendingCommunityReports,
  resolveCommunityReport,
} from '../controllers/communityModerationController.js';

const router = express.Router();

router.get('/feed', authenticate, getCommunityFeed);
router.get('/me/posts', authenticate, getMyCommunityPosts);
router.get('/trending', authenticate, getTrendingPosts);
router.get('/hashtag/:tag', authenticate, getPostsByHashtag);
router.get('/saved', authenticate, listSavedCommunityPosts);

router.post('/posts', authenticate, createCommunityPost);
router.get('/posts/:postId', authenticate, getCommunityPost);
router.post('/posts/:postId/like', authenticate, toggleCommunityLike);
router.post('/posts/:postId/save', authenticate, toggleCommunitySave);
router.post('/posts/:postId/report', authenticate, reportCommunityPost);

router.get('/posts/:postId/comments', authenticate, listCommunityComments);
router.post('/posts/:postId/comments', authenticate, createCommunityComment);

router.post('/users/:userId/block', authenticate, blockCommunityUser);
router.delete('/users/:userId/block', authenticate, unblockCommunityUser);

router.get('/admin/reports/pending', ...authenticateAdmin, listPendingCommunityReports);
router.patch('/admin/reports/:reportId/resolve', ...authenticateAdmin, resolveCommunityReport);

export default router;
