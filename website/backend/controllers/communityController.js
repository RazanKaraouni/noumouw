import * as communityService from '../services/communityService.js';
import { getParentUserId } from '../utils/authContext.js';
import { userFacingErrorMessage } from '../utils/errorFeedback.js';

function parentUserIdFromRequest(req) {
  return getParentUserId(req) || req.auth?.userId;
}

function handleServiceError(res, err, label) {
  console.error(`[${label}]`, err);
  const status = err.status || 500;
  const message = userFacingErrorMessage(err);
  return res.status(status).json({ error: message, message });
}

/** GET /api/community/feed */
export async function getCommunityFeed(req, res) {
  try {
    const viewerId = parentUserIdFromRequest(req);
    if (!viewerId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const { limit, offset } = communityService.sanitizePagination(req.query);
    const excludeSelf =
      req.query.exclude_self === 'true' || req.query.scope === 'others';
    const posts = await communityService.getFeed({
      viewerId,
      ageCategoryInput: req.query.age_category,
      developmentalCategoryInput: req.query.developmental_category,
      limit,
      offset,
      excludeSelf,
    });

    return res.json({ posts, limit, offset });
  } catch (err) {
    return handleServiceError(res, err, 'getCommunityFeed');
  }
}

/** GET /api/community/me/posts */
export async function getMyCommunityPosts(req, res) {
  try {
    const userId = parentUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const { limit, offset } = communityService.sanitizePagination(req.query);
    const posts = await communityService.getMyPosts({
      userId,
      ageCategoryInput: req.query.age_category,
      developmentalCategoryInput: req.query.developmental_category,
      limit,
      offset,
    });

    return res.json({ posts, limit, offset });
  } catch (err) {
    return handleServiceError(res, err, 'getMyCommunityPosts');
  }
}

/** GET /api/community/trending */
export async function getTrendingPosts(req, res) {
  try {
    const viewerId = parentUserIdFromRequest(req);
    if (!viewerId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const posts = await communityService.getTrendingFeed({ viewerId, limit });

    return res.json({ posts, limit });
  } catch (err) {
    return handleServiceError(res, err, 'getTrendingPosts');
  }
}

/** GET /api/community/hashtag/:tag */
export async function getPostsByHashtag(req, res) {
  try {
    const viewerId = parentUserIdFromRequest(req);
    if (!viewerId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const { limit, offset } = communityService.sanitizePagination(req.query);
    const posts = await communityService.getPostsByHashtag({
      viewerId,
      hashtag: req.params.tag,
      limit,
      offset,
    });

    return res.json({ posts, hashtag: req.params.tag, limit, offset });
  } catch (err) {
    return handleServiceError(res, err, 'getPostsByHashtag');
  }
}

/** POST /api/community/posts */
export async function createCommunityPost(req, res) {
  try {
    const userId = parentUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const { content, age_category, developmental_category, locale_tag, is_anonymous, image_url } =
      req.body || {};
    const post = await communityService.createPost({
      userId,
      content,
      ageCategoryInput: age_category,
      developmentalCategoryInput: developmental_category,
      localeTag: locale_tag,
      isAnonymous: is_anonymous,
      imageUrl: image_url,
    });

    return res.status(201).json(post);
  } catch (err) {
    return handleServiceError(res, err, 'createCommunityPost');
  }
}

/** GET /api/community/posts/:postId */
export async function getCommunityPost(req, res) {
  try {
    const viewerId = parentUserIdFromRequest(req);
    if (!viewerId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const post = await communityService.getPostDetail({
      postId: req.params.postId,
      viewerId,
    });

    return res.json(post);
  } catch (err) {
    return handleServiceError(res, err, 'getCommunityPost');
  }
}

/** POST /api/community/posts/:postId/like */
export async function toggleCommunityLike(req, res) {
  try {
    const userId = parentUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const result = await communityService.toggleLike({
      postId: req.params.postId,
      userId,
    });

    return res.json(result);
  } catch (err) {
    return handleServiceError(res, err, 'toggleCommunityLike');
  }
}

/** POST /api/community/posts/:postId/save */
export async function toggleCommunitySave(req, res) {
  try {
    const userId = parentUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const result = await communityService.toggleSave({
      postId: req.params.postId,
      userId,
    });

    return res.json(result);
  } catch (err) {
    return handleServiceError(res, err, 'toggleCommunitySave');
  }
}

/** GET /api/community/saved */
export async function listSavedCommunityPosts(req, res) {
  try {
    const userId = parentUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const { limit, offset } = communityService.sanitizePagination(req.query);
    const posts = await communityService.listSavedPosts({ userId, limit, offset });

    return res.json({ posts, limit, offset });
  } catch (err) {
    return handleServiceError(res, err, 'listSavedCommunityPosts');
  }
}

/** GET /api/community/posts/:postId/comments */
export async function listCommunityComments(req, res) {
  try {
    const { limit, offset } = communityService.sanitizePagination(req.query);
    const comments = await communityService.getComments({
      postId: req.params.postId,
      limit,
      offset,
    });

    return res.json({ comments, limit, offset });
  } catch (err) {
    return handleServiceError(res, err, 'listCommunityComments');
  }
}

/** POST /api/community/posts/:postId/comments */
export async function createCommunityComment(req, res) {
  try {
    const userId = parentUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const comment = await communityService.addComment({
      postId: req.params.postId,
      userId,
      content: req.body?.content,
    });

    return res.status(201).json(comment);
  } catch (err) {
    return handleServiceError(res, err, 'createCommunityComment');
  }
}

/** POST /api/community/posts/:postId/report */
export async function reportCommunityPost(req, res) {
  try {
    const userId = parentUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const report = await communityService.reportPost({
      postId: req.params.postId,
      userId,
      reason: req.body?.reason,
    });

    return res.status(201).json(report);
  } catch (err) {
    return handleServiceError(res, err, 'reportCommunityPost');
  }
}

/** POST /api/community/users/:userId/block */
export async function blockCommunityUser(req, res) {
  try {
    const blockerId = parentUserIdFromRequest(req);
    if (!blockerId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const row = await communityService.blockUser({
      blockerId,
      blockedUserId: req.params.userId,
    });

    return res.status(201).json(row);
  } catch (err) {
    return handleServiceError(res, err, 'blockCommunityUser');
  }
}

/** DELETE /api/community/users/:userId/block */
export async function unblockCommunityUser(req, res) {
  try {
    const blockerId = parentUserIdFromRequest(req);
    if (!blockerId) {
      return res.status(401).json({ error: 'Parent session required.' });
    }

    const result = await communityService.unblockUser({
      blockerId,
      blockedUserId: req.params.userId,
    });

    return res.json(result);
  } catch (err) {
    return handleServiceError(res, err, 'unblockCommunityUser');
  }
}
