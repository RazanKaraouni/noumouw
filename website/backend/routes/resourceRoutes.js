import express from 'express';
import { authenticate, authenticateTherapist } from '../middleware/auth.js';
import {
  listMyResourceLikes,
  toggleResourceLike,
} from '../controllers/resourceLikesController.js';
import {
  listMyResourceSaves,
  listMySavedResources,
  toggleResourceSave,
} from '../controllers/resourceSavesController.js';
import {
  createResource,
  deleteResource,
  getArticleBody,
  handleResourceMulterError,
  listMyResources,
  resourceUploadFields,
  updateResource,
} from '../controllers/resourceController.js';

const router = express.Router();

router.get('/likes', authenticate, listMyResourceLikes);
router.get('/saves', authenticate, listMyResourceSaves);
router.get('/saved', authenticate, listMySavedResources);
router.post('/:id/like', authenticate, toggleResourceLike);
router.post('/:id/save', authenticate, toggleResourceSave);
router.get('/articles/:id/body', authenticate, getArticleBody);

router.get('/', ...authenticateTherapist, listMyResources);
router.post('/', ...authenticateTherapist, resourceUploadFields, createResource);
router.put('/:id', ...authenticateTherapist, resourceUploadFields, updateResource);
router.delete('/:id', ...authenticateTherapist, deleteResource);

router.use(handleResourceMulterError);

export { ensureTherapistContentBucket } from '../controllers/resourceController.js';

export default router;
