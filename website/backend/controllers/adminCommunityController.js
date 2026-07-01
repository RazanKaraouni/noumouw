import supabase from '../config/supabase.js';
import * as communityModel from '../models/communityModel.js';
import { getAdminId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { writeModerationAudit, lookupSubjectByUserId } from '../services/moderationAuditService.js';
import { queueModerationNotification } from '../services/moderationNotifyService.js';
import { suspendParentAccount } from '../services/parentSuspensionService.js';
import { ageCategoryLabel } from '../utils/communityAgeCategory.js';
import {
  developmentalCategoryLabel,
  normalizeDevelopmentalCategory,
} from '../utils/communityDevelopmentalCategory.js';
import { AGE_CATEGORIES } from '../utils/communityAgeCategory.js';
import { DEVELOPMENTAL_CATEGORIES } from '../utils/communityDevelopmentalCategory.js';
import { apiCache } from '../utils/ttlCache.js';

const ADMIN_COMMUNITY_POSTS_CACHE_TTL_MS = 30_000;

function invalidateAdminCommunityPostsCache() {
  apiCache.invalidatePrefix('admin:community:posts:');
}

function communityPostsCacheKey(filters) {
  return `admin:community:posts:${JSON.stringify(filters)}`;
}

function truncatePreview(text, max = 140) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function authorLabel(post, parentMap) {
  if (post.is_anonymous) return 'Anonymous';
  const parent = parentMap.get(post.user_id);
  return parent?.full_name || 'Unknown parent';
}

async function enrichPostsForAdmin(posts) {
  const list = posts || [];
  if (!list.length) return [];

  const postIds = list.map((p) => p.post_id || p.id).filter(Boolean);
  const userIds = list.map((p) => p.user_id).filter(Boolean);

  const [likeCounts, commentCounts, parentMap] = await Promise.all([
    communityModel.countLikesForPosts(postIds),
    communityModel.countCommentsForPosts(postIds),
    communityModel.fetchParentsByUserIds(userIds),
  ]);

  return list.map((post) => {
    const id = post.post_id || post.id;
    const parent = parentMap.get(post.user_id);
    return {
      ...post,
      post_id: id,
      author_name: authorLabel(post, parentMap),
      moderation_author_name: parent?.full_name || parent?.email || 'Unknown parent',
      content_preview: truncatePreview(post.content),
      category_label: developmentalCategoryLabel(post.developmental_category),
      age_group_label: ageCategoryLabel(post.age_category) || post.age_category || '—',
      likes_count: likeCounts.get(id) || 0,
      comments_count: commentCounts.get(id) || 0,
    };
  });
}

async function insertUserWarning({ userId, reason, adminId }) {
  const text = String(reason || '').trim();
  if (!text) throw new Error('Warning reason is required.');

  const payload = {
    user_id: userId,
    reason: text,
    report_id: null,
  };
  if (adminId) payload.admin_id = adminId;

  const { error } = await supabase.from('user_warnings').insert(payload);
  if (error) throw error;
}

/** GET /api/admin/community/posts */
export async function listAdminCommunityPosts(req, res) {
  try {
    const developmentalRaw = String(req.query.developmental_category || '').trim();
    const developmental_category = developmentalRaw
      ? normalizeDevelopmentalCategory(developmentalRaw)
      : null;
    if (developmentalRaw && !developmental_category) {
      return res.status(400).json({ message: 'Invalid developmental_category.' });
    }

    const age_category = String(req.query.age_category || '').trim() || null;
    if (age_category && !AGE_CATEGORIES.includes(age_category) && age_category !== 'all') {
      return res.status(400).json({ message: 'Invalid age_category.' });
    }

    let is_anonymous;
    const anonParam = req.query.is_anonymous;
    if (anonParam === 'true' || anonParam === true) is_anonymous = true;
    else if (anonParam === 'false' || anonParam === false) is_anonymous = false;

    const filters = {
      developmental_category: developmental_category || undefined,
      age_category: age_category && age_category !== 'all' ? age_category : undefined,
      is_anonymous,
      date_from: req.query.date_from || undefined,
      date_to: req.query.date_to || undefined,
    };

    const payload = await apiCache.getOrSet(
      communityPostsCacheKey(filters),
      ADMIN_COMMUNITY_POSTS_CACHE_TTL_MS,
      async () => {
        const posts = await communityModel.listPostsForAdmin(filters);
        const enriched = await enrichPostsForAdmin(posts);
        return {
          posts: enriched,
          filterOptions: {
            developmental_categories: DEVELOPMENTAL_CATEGORIES,
            age_categories: AGE_CATEGORIES,
          },
        };
      },
    );

    return res.json(payload);
  } catch (err) {
    console.error('[listAdminCommunityPosts]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** GET /api/admin/community/posts/:postId */
export async function getAdminCommunityPostDetail(req, res) {
  try {
    const { postId } = req.params;
    const post = await communityModel.findPostById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const [enrichedPost] = await enrichPostsForAdmin([post]);
    const comments = await communityModel.listAllCommentsForPost(postId);
    const commentUserIds = comments.map((c) => c.user_id).filter(Boolean);
    const parentMap = await communityModel.fetchParentsByUserIds([
      post.user_id,
      ...commentUserIds,
    ].filter(Boolean));

    const commentsEnriched = comments.map((c) => ({
      ...c,
      author_name: parentMap.get(c.user_id)?.full_name || 'Unknown parent',
    }));

    return res.json({
      post: {
        ...enrichedPost,
        content: post.content,
        image_url: post.image_url,
        hashtags: post.hashtags,
      },
      comments: commentsEnriched,
    });
  } catch (err) {
    console.error('[getAdminCommunityPostDetail]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** DELETE /api/admin/community/posts/:postId */
export async function deleteAdminCommunityPost(req, res) {
  try {
    const { postId } = req.params;
    const existing = await communityModel.findPostById(postId);
    if (!existing) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    await communityModel.deletePostById(postId);
    invalidateAdminCommunityPostsCache();
    await writeModerationAudit({
      event_type: 'community_post_deleted',
      adminId: getAdminId(req),
      targetTable: 'community_posts',
      targetId: postId,
      metadata: {
        target_label: truncatePreview(existing.content, 80),
        reason: 'Admin deleted community post',
      },
    });
    return res.json({ ok: true, post_id: postId });
  } catch (err) {
    console.error('[deleteAdminCommunityPost]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** DELETE /api/admin/community/comments/:commentId */
export async function deleteAdminCommunityComment(req, res) {
  try {
    const { commentId } = req.params;
    const { data, error } = await supabase
      .from('community_comments')
      .select('comment_id, post_id')
      .eq('comment_id', commentId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    await communityModel.deleteCommentById(commentId);
    invalidateAdminCommunityPostsCache();
    await writeModerationAudit({
      event_type: 'community_comment_deleted',
      adminId: getAdminId(req),
      targetTable: 'community_comments',
      targetId: commentId,
      metadata: {
        post_id: data.post_id,
        reason: 'Admin deleted community comment',
      },
    });
    return res.json({ ok: true, comment_id: commentId, post_id: data.post_id });
  } catch (err) {
    console.error('[deleteAdminCommunityComment]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** POST /api/admin/community/users/:userId/warn */
export async function warnCommunityUser(req, res) {
  try {
    const { userId } = req.params;
    const reason = String(req.body?.reason || '').trim();
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    await insertUserWarning({ userId, reason, adminId: getAdminId(req) });
    queueModerationNotification({ userId, action: 'warn', reason });
    const subject = await lookupSubjectByUserId(userId);
    await writeModerationAudit({
      event_type: 'community_user_warned',
      adminId: getAdminId(req),
      targetTable: 'parents',
      targetId: userId,
      metadata: { reason, user_id: userId, ...subject },
    });
    return res.json({ ok: true, user_id: userId });
  } catch (err) {
    const raw = String(err?.message || '');
    const status = /required|not found/i.test(raw) ? 400 : 500;
    return sendErrorResponse(res, err, status);
  }
}

/** POST /api/admin/community/users/:userId/suspend */
export async function suspendCommunityUser(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    const reason =
      String(req.body?.reason || '').trim() || 'Admin suspended from community posts';
    const data = await suspendParentAccount(userId, reason);
    invalidateAdminCommunityPostsCache();
    queueModerationNotification({
      userId,
      action: 'suspend',
      reason,
    });
    const subject = await lookupSubjectByUserId(userId);
    await writeModerationAudit({
      event_type: 'community_user_suspended',
      adminId: getAdminId(req),
      targetTable: 'parents',
      targetId: userId,
      metadata: {
        user_id: userId,
        user_email: data?.email,
        reason,
        ...subject,
      },
    });
    return res.json({ ok: true, user: data });
  } catch (err) {
    const raw = String(err?.message || '');
    const status = /not found/i.test(raw) ? 404 : 500;
    return sendErrorResponse(res, err, status);
  }
}
