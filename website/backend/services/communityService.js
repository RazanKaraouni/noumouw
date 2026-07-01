import { extractHashtags } from '../utils/hashtagExtractor.js';
import { normalizeAgeCategory } from '../utils/communityAgeCategory.js';
import { normalizeDevelopmentalCategory } from '../utils/communityDevelopmentalCategory.js';
import {
  buildPublicAuthor,
  publicAuthorUserIds,
  sanitizePublicPost,
} from '../utils/communityAnonymity.js';
import * as communityModel from '../models/communityModel.js';

export { extractHashtags, normalizeAgeCategory, normalizeDevelopmentalCategory };

export function sanitizePagination(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

async function enrichPosts(posts, viewerId, { revealOwnerId = false } = {}) {
  if (!posts?.length) return [];

  const postIds = posts.map((p) => p.id).filter(Boolean);
  const authorIds = revealOwnerId
    ? [...new Set(posts.map((p) => p.user_id).filter(Boolean))]
    : publicAuthorUserIds(posts);

  const [engagement, parents, therapists] = await Promise.all([
    communityModel.getPostEngagementBatch(postIds, viewerId),
    communityModel.fetchParentsByUserIds(authorIds),
    communityModel.fetchTherapistsByUserIds(authorIds),
  ]);

  const {
    likeCounts,
    commentCounts,
    likedIds,
    savedIds,
    specialistPostIds,
  } = engagement;

  return posts.map((post) => {
    const parent = parents.get(post.user_id);
    const therapist = therapists.get(post.user_id);
    const author = buildPublicAuthor(parent, therapist, post.is_anonymous);

    const showOwnerId = revealOwnerId && post.user_id === viewerId;

    return sanitizePublicPost(
      {
        ...post,
        like_count: likeCounts.get(post.id) || 0,
        comment_count: commentCounts.get(post.id) || 0,
        is_liked: likedIds.has(post.id),
        is_saved: savedIds.has(post.id),
        specialist_responded: specialistPostIds.has(post.id),
      },
      author,
      { revealOwnerId: showOwnerId },
    );
  });
}

async function enrichComments(comments) {
  if (!comments?.length) return [];

  const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))];
  const [parents, therapists] = await Promise.all([
    communityModel.fetchParentsByUserIds(userIds),
    communityModel.fetchTherapistsByUserIds(userIds),
  ]);

  return comments.map((comment) => {
    const parent = parents.get(comment.user_id);
    const therapist = therapists.get(comment.user_id);
    return {
      id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      content: comment.content,
      created_at: comment.created_at,
      author: buildPublicAuthor(parent, therapist, false),
    };
  });
}

export async function getFeed({
  viewerId,
  ageCategoryInput,
  developmentalCategoryInput,
  limit,
  offset,
  excludeSelf = false,
}) {
  const ageCategory = ageCategoryInput ? normalizeAgeCategory(ageCategoryInput) : null;
  if (ageCategoryInput && !ageCategory) {
    const err = new Error('Invalid age_category.');
    err.status = 400;
    throw err;
  }

  const developmentalCategory = developmentalCategoryInput
    ? normalizeDevelopmentalCategory(developmentalCategoryInput)
    : null;
  if (developmentalCategoryInput && !developmentalCategory) {
    const err = new Error('Invalid developmental_category.');
    err.status = 400;
    throw err;
  }

  const posts = await communityModel.rpcCommunityFeed({
    viewerId,
    ageCategory,
    developmentalCategory,
    limit,
    offset,
    excludeUserId: excludeSelf ? viewerId : null,
  });

  return enrichPosts(posts, viewerId);
}

export async function getMyPosts({
  userId,
  ageCategoryInput,
  developmentalCategoryInput,
  limit,
  offset,
}) {
  const ageCategory = ageCategoryInput ? normalizeAgeCategory(ageCategoryInput) : null;
  if (ageCategoryInput && !ageCategory) {
    const err = new Error('Invalid age_category.');
    err.status = 400;
    throw err;
  }

  const developmentalCategory = developmentalCategoryInput
    ? normalizeDevelopmentalCategory(developmentalCategoryInput)
    : null;
  if (developmentalCategoryInput && !developmentalCategory) {
    const err = new Error('Invalid developmental_category.');
    err.status = 400;
    throw err;
  }

  const posts = await communityModel.listPostsForUser({
    userId,
    ageCategory,
    developmentalCategory,
    limit,
    offset,
  });

  return enrichPosts(posts, userId, { revealOwnerId: true });
}

export async function getTrendingFeed({ viewerId, limit }) {
  const posts = await communityModel.rpcCommunityTrending({ viewerId, limit });
  return enrichPosts(posts, viewerId);
}

export async function getPostsByHashtag({ viewerId, hashtag, limit, offset }) {
  const posts = await communityModel.searchPostsByHashtag({
    hashtag,
    viewerId,
    limit,
    offset,
  });
  return enrichPosts(posts, viewerId);
}

export async function createPost({
  userId,
  content,
  ageCategoryInput,
  developmentalCategoryInput,
  localeTag,
  isAnonymous,
  imageUrl,
}) {
  const ageCategory = normalizeAgeCategory(ageCategoryInput);
  if (!ageCategory) {
    const err = new Error('age_category is required and must be a recognized value.');
    err.status = 400;
    throw err;
  }

  const developmentalCategory = developmentalCategoryInput
    ? normalizeDevelopmentalCategory(developmentalCategoryInput)
    : null;
  if (developmentalCategoryInput && !developmentalCategory) {
    const err = new Error('developmental_category is not recognized.');
    err.status = 400;
    throw err;
  }

  const body = String(content || '').trim();
  if (!body) {
    const err = new Error('content is required.');
    err.status = 400;
    throw err;
  }

  const hashtags = extractHashtags(body);
  const locale = localeTag ? String(localeTag).trim() : null;

  const post = await communityModel.insertPost({
    user_id: userId,
    is_anonymous: Boolean(isAnonymous),
    age_category: ageCategory,
    developmental_category: developmentalCategory,
    locale_tag: locale && locale.length ? locale : null,
    content: body,
    image_url: imageUrl ? String(imageUrl).trim() : null,
    hashtags,
  });

  const [enriched] = await enrichPosts([post], userId);
  return enriched;
}

export async function getPostDetail({ postId, viewerId }) {
  const post = await communityModel.findPostById(postId);
  if (!post) {
    const err = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  const blockedIds = await communityModel.fetchBlockedUserIds(viewerId);
  if (blockedIds.includes(post.user_id)) {
    const err = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  const [enriched] = await enrichPosts([post], viewerId);
  return enriched;
}

export async function toggleLike({ postId, userId }) {
  const post = await communityModel.findPostById(postId);
  if (!post) {
    const err = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  const existing = await communityModel.findLike(postId, userId);
  if (existing) {
    await communityModel.deleteLike(postId, userId);
    return { liked: false };
  }

  await communityModel.insertLike(postId, userId);
  return { liked: true };
}

export async function toggleSave({ postId, userId }) {
  const post = await communityModel.findPostById(postId);
  if (!post) {
    const err = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  const existing = await communityModel.findSavedPost(postId, userId);
  if (existing) {
    await communityModel.deleteSavedPost(postId, userId);
    return { saved: false };
  }

  await communityModel.insertSavedPost(postId, userId);
  return { saved: true };
}

export async function listSavedPosts({ userId, limit, offset }) {
  const posts = await communityModel.listSavedPostsForUser(userId, { limit, offset });
  return enrichPosts(posts, userId);
}

export async function addComment({ postId, userId, content }) {
  const post = await communityModel.findPostById(postId);
  if (!post) {
    const err = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  const body = String(content || '').trim();
  if (!body) {
    const err = new Error('content is required.');
    err.status = 400;
    throw err;
  }

  const comment = await communityModel.insertComment({
    post_id: postId,
    user_id: userId,
    content: body,
  });

  const [enriched] = await enrichComments([comment]);
  return enriched;
}

export async function getComments({ postId, limit, offset }) {
  const post = await communityModel.findPostById(postId);
  if (!post) {
    const err = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  const comments = await communityModel.listCommentsForPost(postId, { limit, offset });
  return enrichComments(comments);
}

export async function reportPost({ postId, userId, reason }) {
  const post = await communityModel.findPostById(postId);
  if (!post) {
    const err = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  const body = String(reason || '').trim();
  if (!body) {
    const err = new Error('reason is required.');
    err.status = 400;
    throw err;
  }

  return communityModel.insertResourceReport({
    reporterId: userId,
    postId,
    reason: body,
  });
}

export async function blockUser({ blockerId, blockedUserId }) {
  if (blockerId === blockedUserId) {
    const err = new Error('You cannot block yourself.');
    err.status = 400;
    throw err;
  }

  return communityModel.upsertBlock({ blockerId, blockedUserId });
}

export async function unblockUser({ blockerId, blockedUserId }) {
  await communityModel.deleteBlock({ blockerId, blockedUserId });
  return { ok: true };
}

export async function listPendingReportsForAdmin() {
  return communityModel.listPendingCommunityReports();
}

export async function resolveCommunityReport({ reportId, action }) {
  const report = await communityModel.findResourceReportById(reportId);
  if (!report) {
    const err = new Error('Report not found.');
    err.status = 404;
    throw err;
  }
  if (report.status !== 'pending') {
    const err = new Error('Report is no longer pending.');
    err.status = 400;
    throw err;
  }
  if (!['post', 'comment'].includes(report.target_type)) {
    const err = new Error('Not a community report.');
    err.status = 400;
    throw err;
  }

  if (action === 'content_removed') {
    if (report.target_type === 'post' && report.post_id) {
      await communityModel.deletePostById(report.post_id);
    } else if (report.target_type === 'comment' && report.comment_id) {
      await communityModel.deleteCommentById(report.comment_id);
    }
  }

  const status = action === 'dismissed' ? 'dismissed' : 'content_removed';
  return communityModel.updateResourceReportStatus(reportId, status);
}
