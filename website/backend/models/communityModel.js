import supabase from '../config/supabase.js';

const POST_COLUMNS =
  'post_id, user_id, is_anonymous, age_category, developmental_category, locale_tag, content, image_url, hashtags, created_at, updated_at';

const POST_ADMIN_COLUMNS = POST_COLUMNS;

const COMMENT_COLUMNS = 'comment_id, post_id, user_id, comment_text, created_at';

/** Normalize DB row → API shape (id alias for clients). */
export function mapPostRow(row) {
  if (!row) return null;
  const postId = row.post_id ?? row.id;
  return {
    id: postId,
    post_id: postId,
    user_id: row.user_id,
    is_anonymous: Boolean(row.is_anonymous),
    age_category: row.age_category ?? '0-2',
    developmental_category: row.developmental_category ?? null,
    locale_tag: row.locale_tag ?? null,
    content: row.content,
    image_url: row.image_url ?? null,
    hashtags: row.hashtags ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    trend_score: row.trend_score,
  };
}

export function mapCommentRow(row) {
  if (!row) return null;
  const commentId = row.comment_id ?? row.id;
  return {
    id: commentId,
    comment_id: commentId,
    post_id: row.post_id,
    user_id: row.user_id,
    content: row.comment_text ?? row.content,
    created_at: row.created_at,
  };
}

export async function fetchBlockedUserIds(viewerId) {
  const { data, error } = await supabase
    .from('community_blocked_users')
    .select('blocked_user_id')
    .eq('blocker_id', viewerId);

  if (error) throw error;
  return (data || []).map((row) => row.blocked_user_id).filter(Boolean);
}

export async function rpcCommunityFeed({
  viewerId,
  ageCategory,
  developmentalCategory,
  limit,
  offset,
  excludeUserId,
}) {
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);

  const { data, error } = await supabase.rpc('community_feed', {
    p_viewer_id: viewerId,
    p_age_category: ageCategory ?? null,
    p_developmental_category: developmentalCategory ?? null,
    p_limit: lim,
    p_offset: off,
    p_exclude_user_id: excludeUserId ?? null,
  });

  if (!error) {
    return (data || []).map(mapPostRow);
  }

  // Fallback when RPC is not migrated yet.
  const blockedIds = await fetchBlockedUserIds(viewerId);

  let query = supabase
    .from('community_posts')
    .select(POST_COLUMNS)
    .order('created_at', { ascending: false })
    .range(off, off + lim - 1);

  if (blockedIds.length) {
    query = query.not('user_id', 'in', `(${blockedIds.join(',')})`);
  }
  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }
  if (ageCategory) {
    query = query.eq('age_category', ageCategory);
  }
  if (developmentalCategory) {
    query = query.eq('developmental_category', developmentalCategory);
  }

  const { data: rows, error: queryError } = await query;
  if (queryError) throw queryError;
  return (rows || []).map(mapPostRow);
}

export async function listPostsForUser({
  userId,
  ageCategory,
  developmentalCategory,
  limit,
  offset,
}) {
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);

  let query = supabase
    .from('community_posts')
    .select(POST_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(off, off + lim - 1);

  if (ageCategory) {
    query = query.eq('age_category', ageCategory);
  }
  if (developmentalCategory) {
    query = query.eq('developmental_category', developmentalCategory);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPostRow);
}

export async function rpcCommunityTrending({ viewerId, limit }) {
  const blockedIds = await fetchBlockedUserIds(viewerId);
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('community_posts')
    .select(POST_COLUMNS)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(Math.min(lim * 5, 100));

  if (blockedIds.length) {
    query = query.not('user_id', 'in', `(${blockedIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data || []).map(mapPostRow);
  if (!posts.length) return [];

  const postIds = posts.map((p) => p.id).filter(Boolean);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [likesRes, commentsRes] = await Promise.all([
    supabase
      .from('community_likes')
      .select('post_id')
      .in('post_id', postIds)
      .gte('created_at', dayAgo),
    supabase
      .from('community_comments')
      .select('post_id')
      .in('post_id', postIds)
      .gte('created_at', dayAgo),
  ]);

  if (likesRes.error) throw likesRes.error;
  if (commentsRes.error) throw commentsRes.error;

  const likeCounts = new Map();
  for (const row of likesRes.data || []) {
    likeCounts.set(row.post_id, (likeCounts.get(row.post_id) || 0) + 1);
  }
  const commentCounts = new Map();
  for (const row of commentsRes.data || []) {
    commentCounts.set(row.post_id, (commentCounts.get(row.post_id) || 0) + 1);
  }

  return posts
    .map((post) => ({
      ...post,
      trend_score:
        (likeCounts.get(post.id) || 0) * 2 + (commentCounts.get(post.id) || 0) * 3,
    }))
    .sort((a, b) => {
      const scoreDiff = (b.trend_score || 0) - (a.trend_score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, lim);
}

export async function insertPost(row) {
  const { data, error } = await supabase
    .from('community_posts')
    .insert(row)
    .select(POST_COLUMNS)
    .single();

  if (error) throw error;
  return mapPostRow(data);
}

export async function findPostById(postId) {
  const { data, error } = await supabase
    .from('community_posts')
    .select(POST_COLUMNS)
    .eq('post_id', postId)
    .maybeSingle();

  if (error) throw error;
  return mapPostRow(data);
}

export async function deletePostById(postId) {
  const { error } = await supabase.from('community_posts').delete().eq('post_id', postId);
  if (error) throw error;
}

export async function deleteCommentById(commentId) {
  const { error } = await supabase
    .from('community_comments')
    .delete()
    .eq('comment_id', commentId);
  if (error) throw error;
}

export async function listCommentsForPost(postId, { limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);

  const { data, error } = await supabase
    .from('community_comments')
    .select(COMMENT_COLUMNS)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .range(off, off + lim - 1);

  if (error) throw error;
  return (data || []).map(mapCommentRow);
}

export async function insertComment(row) {
  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      post_id: row.post_id,
      user_id: row.user_id,
      comment_text: row.content ?? row.comment_text,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error) throw error;
  return mapCommentRow(data);
}

export async function findLike(postId, userId) {
  const { data, error } = await supabase
    .from('community_likes')
    .select('like_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function insertLike(postId, userId) {
  const { data, error } = await supabase
    .from('community_likes')
    .insert({ post_id: postId, user_id: userId })
    .select('like_id, post_id, user_id, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLike(postId, userId) {
  const { error } = await supabase
    .from('community_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function findSavedPost(postId, userId) {
  const { data, error } = await supabase
    .from('community_saved_posts')
    .select('saved_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function insertSavedPost(postId, userId) {
  const { data, error } = await supabase
    .from('community_saved_posts')
    .insert({ post_id: postId, user_id: userId })
    .select('saved_id, post_id, user_id, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSavedPost(postId, userId) {
  const { error } = await supabase
    .from('community_saved_posts')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function listSavedPostsForUser(userId, { limit = 20, offset = 0 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);

  const { data, error } = await supabase
    .from('community_saved_posts')
    .select(`created_at, community_posts (${POST_COLUMNS})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(off, off + lim - 1);

  if (error) throw error;
  return (data || []).map((row) => mapPostRow(row.community_posts)).filter(Boolean);
}

/** Inserts into resource_reports (existing moderation queue). */
export async function insertResourceReport({ reporterId, postId, reason }) {
  const { data, error } = await supabase
    .from('resource_reports')
    .insert({
      reporter_id: reporterId,
      target_type: 'post',
      post_id: postId,
      reason: String(reason || 'Community post report').trim(),
      status: 'pending',
    })
    .select(
      'report_id, reporter_id, target_type, post_id, reason, status, created_at, updated_at',
    )
    .single();

  if (error) throw error;
  return data;
}

export async function upsertBlock({ blockerId, blockedUserId }) {
  const { data, error } = await supabase
    .from('community_blocked_users')
    .upsert(
      { blocker_id: blockerId, blocked_user_id: blockedUserId },
      { onConflict: 'blocker_id,blocked_user_id' },
    )
    .select('block_id, blocker_id, blocked_user_id, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBlock({ blockerId, blockedUserId }) {
  const { error } = await supabase
    .from('community_blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_user_id', blockedUserId);

  if (error) throw error;
}

export async function countLikesForPosts(postIds) {
  const { counts } = await getLikeStatsForPosts(postIds);
  return counts;
}

export async function getPostEngagementBatch(postIds, viewerId) {
  if (!postIds.length) {
    return {
      likeCounts: new Map(),
      commentCounts: new Map(),
      likedIds: new Set(),
      savedIds: new Set(),
      specialistPostIds: new Set(),
    };
  }

  const { data, error } = await supabase.rpc('community_post_engagement', {
    p_post_ids: postIds,
    p_viewer_id: viewerId,
  });

  if (!error) {
    const likeCounts = new Map();
    const commentCounts = new Map();
    const likedIds = new Set();
    const savedIds = new Set();
    const specialistPostIds = new Set();

    for (const row of data || []) {
      likeCounts.set(row.post_id, Number(row.like_count) || 0);
      commentCounts.set(row.post_id, Number(row.comment_count) || 0);
      if (row.is_liked) likedIds.add(row.post_id);
      if (row.is_saved) savedIds.add(row.post_id);
      if (row.specialist_responded) specialistPostIds.add(row.post_id);
    }

    return { likeCounts, commentCounts, likedIds, savedIds, specialistPostIds };
  }

  const [likeStats, commentStats, savedIds] = await Promise.all([
    getLikeStatsForPosts(postIds, viewerId),
    getCachedTherapistUserIds().then((ids) => getCommentStatsForPosts(postIds, ids)),
    viewerSavedPostIds(viewerId, postIds),
  ]);

  return {
    likeCounts: likeStats.counts,
    commentCounts: commentStats.counts,
    likedIds: likeStats.likedIds,
    savedIds,
    specialistPostIds: commentStats.specialistPostIds,
  };
}

export async function getLikeStatsForPosts(postIds, viewerId = null) {
  if (!postIds.length) return { counts: new Map(), likedIds: new Set() };

  const { data, error } = await supabase
    .from('community_likes')
    .select('post_id, user_id')
    .in('post_id', postIds);

  if (error) throw error;

  const counts = new Map();
  const likedIds = new Set();
  for (const row of data || []) {
    counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
    if (viewerId && row.user_id === viewerId) {
      likedIds.add(row.post_id);
    }
  }
  return { counts, likedIds };
}

export async function countCommentsForPosts(postIds) {
  const { counts } = await getCommentStatsForPosts(postIds, []);
  return counts;
}

const THERAPIST_IDS_TTL_MS = 5 * 60 * 1000;
let therapistIdsCache = null;

export async function getCachedTherapistUserIds() {
  const now = Date.now();
  if (therapistIdsCache && therapistIdsCache.expiresAt > now) {
    return therapistIdsCache.ids;
  }

  const { data, error } = await supabase.from('therapists').select('user_id');
  if (error) throw error;

  const ids = (data || []).map((row) => row.user_id).filter(Boolean);
  therapistIdsCache = { ids, expiresAt: now + THERAPIST_IDS_TTL_MS };
  return ids;
}

export async function getCommentStatsForPosts(postIds, specialistUserIds = []) {
  if (!postIds.length) {
    return { counts: new Map(), specialistPostIds: new Set() };
  }

  const { data, error } = await supabase
    .from('community_comments')
    .select('post_id, user_id')
    .in('post_id', postIds);

  if (error) throw error;

  const counts = new Map();
  const specialistPostIds = new Set();
  const specialistSet = new Set(specialistUserIds);

  for (const row of data || []) {
    counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
    if (specialistSet.has(row.user_id)) {
      specialistPostIds.add(row.post_id);
    }
  }

  return { counts, specialistPostIds };
}

/** Post IDs that have at least one comment authored by a therapist/specialist. */
export async function postIdsWithSpecialistResponse(postIds) {
  const specialistUserIds = await getCachedTherapistUserIds();
  const { specialistPostIds } = await getCommentStatsForPosts(postIds, specialistUserIds);
  return specialistPostIds;
}

export async function viewerLikedPostIds(viewerId, postIds) {
  if (!postIds.length) return new Set();

  const { data, error } = await supabase
    .from('community_likes')
    .select('post_id')
    .eq('user_id', viewerId)
    .in('post_id', postIds);

  if (error) throw error;
  return new Set((data || []).map((row) => row.post_id));
}

export async function viewerSavedPostIds(viewerId, postIds) {
  if (!postIds.length) return new Set();

  const { data, error } = await supabase
    .from('community_saved_posts')
    .select('post_id')
    .eq('user_id', viewerId)
    .in('post_id', postIds);

  if (error) throw error;
  return new Set((data || []).map((row) => row.post_id));
}

function isMissingTherapistColumnError(error, column) {
  const msg = String(error?.message || '');
  return (
    error?.code === '42703' ||
    msg.includes(`column therapists.${column} does not exist`) ||
    msg.includes(`column "${column}" does not exist`)
  );
}

export async function fetchTherapistsByUserIds(userIds) {
  if (!userIds.length) return new Map();

  let { data, error } = await supabase
    .from('therapists')
    .select('user_id, full_name, profile_image_url')
    .in('user_id', userIds);

  if (error && isMissingTherapistColumnError(error, 'profile_image_url')) {
    ({ data, error } = await supabase
      .from('therapists')
      .select('user_id, full_name')
      .in('user_id', userIds));
  }

  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (row.user_id) {
      map.set(row.user_id, {
        ...row,
        profile_image_url: row.profile_image_url ?? null,
      });
    }
  }
  return map;
}

export async function fetchParentsByUserIds(userIds) {
  if (!userIds.length) return new Map();

  const { data, error } = await supabase
    .from('parents')
    .select('user_id, full_name, profile_image_url')
    .in('user_id', userIds);

  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (row.user_id) map.set(row.user_id, row);
  }
  return map;
}

export async function searchPostsByHashtag({ hashtag, viewerId, limit, offset }) {
  const tag = String(hashtag || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '');
  if (!tag) return [];

  const blockedIds = await fetchBlockedUserIds(viewerId);
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);

  let query = supabase
    .from('community_posts')
    .select(POST_COLUMNS)
    .contains('hashtags', [tag])
    .order('created_at', { ascending: false })
    .range(off, off + lim - 1);

  if (blockedIds.length) {
    query = query.not('user_id', 'in', `(${blockedIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPostRow);
}

export async function listPostsForAdmin(filters = {}) {
  let query = supabase
    .from('community_posts')
    .select(POST_ADMIN_COLUMNS)
    .order('created_at', { ascending: false });

  if (filters.developmental_category) {
    query = query.eq('developmental_category', filters.developmental_category);
  }
  if (filters.age_category) {
    query = query.eq('age_category', filters.age_category);
  }
  if (filters.is_anonymous === true || filters.is_anonymous === 'true') {
    query = query.eq('is_anonymous', true);
  } else if (filters.is_anonymous === false || filters.is_anonymous === 'false') {
    query = query.eq('is_anonymous', false);
  }
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters.date_to) {
    const end = new Date(filters.date_to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
  }

  const lim = Math.min(Math.max(Number(filters.limit) || 200, 1), 500);
  query = query.limit(lim);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPostRow);
}

export async function listAllCommentsForPost(postId) {
  const { data, error } = await supabase
    .from('community_comments')
    .select(COMMENT_COLUMNS)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapCommentRow);
}

export async function listPendingCommunityReports() {
  const { data, error } = await supabase
    .from('resource_reports')
    .select(
      `report_id, reporter_id, target_type, post_id, comment_id, reason, status, created_at, updated_at,
       community_posts (post_id, content, user_id, is_anonymous, age_category, created_at)`,
    )
    .eq('status', 'pending')
    .in('target_type', ['post', 'comment'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function findResourceReportById(reportId) {
  const { data, error } = await supabase
    .from('resource_reports')
    .select('*')
    .eq('report_id', reportId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateResourceReportStatus(reportId, status) {
  const { data, error } = await supabase
    .from('resource_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('report_id', reportId)
    .select(
      'report_id, reporter_id, target_type, post_id, comment_id, reason, status, created_at, updated_at',
    )
    .single();

  if (error) throw error;
  return data;
}
