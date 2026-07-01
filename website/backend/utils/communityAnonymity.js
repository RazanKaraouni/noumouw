/**
 * Public-facing community post anonymity.
 *
 * Database rows always retain `user_id` for moderation, deletion, and reports.
 * Clients must never receive the real author identity when `is_anonymous` is true.
 */

export const ANONYMOUS_DISPLAY_NAME = 'Anonymous Parent';

/**
 * @param {{ full_name?: string | null, profile_image_url?: string | null } | undefined} parentRow
 * @param {{ full_name?: string | null, profile_image_url?: string | null } | undefined} therapistRow
 * @param {boolean} isAnonymous
 */
export function buildPublicAuthor(parentRow, therapistRow, isAnonymous) {
  if (isAnonymous) {
    return {
      display_name: ANONYMOUS_DISPLAY_NAME,
      profile_image_url: null,
      is_anonymous: true,
      role: 'parent',
    };
  }

  if (therapistRow) {
    return {
      display_name: therapistRow.full_name || 'Specialist',
      profile_image_url: therapistRow.profile_image_url || null,
      is_anonymous: false,
      role: 'specialist',
    };
  }

  return {
    display_name: parentRow?.full_name || 'Community member',
    profile_image_url: parentRow?.profile_image_url || null,
    is_anonymous: false,
    role: 'parent',
  };
}

/**
 * Strip author identity from a post payload before it is sent to mobile/web clients.
 *
 * @param {Record<string, unknown>} post Internal post row (must include user_id + is_anonymous)
 * @param {ReturnType<typeof buildPublicAuthor>} author
 */
export function sanitizePublicPost(post, author, { revealOwnerId = false } = {}) {
  const isAnonymous = Boolean(post.is_anonymous);

  return {
    id: post.id,
    user_id: isAnonymous && !revealOwnerId ? null : post.user_id ?? null,
    is_anonymous: isAnonymous,
    age_category: post.age_category,
    developmental_category: post.developmental_category || null,
    locale_tag: post.locale_tag || null,
    content: post.content,
    image_url: post.image_url || null,
    hashtags: post.hashtags || [],
    created_at: post.created_at,
    updated_at: post.updated_at,
    author,
    like_count: post.like_count,
    comment_count: post.comment_count,
    is_liked: post.is_liked,
    is_saved: post.is_saved,
    specialist_responded: post.specialist_responded,
    trend_score: post.trend_score != null ? Number(post.trend_score) : undefined,
  };
}

/** User IDs that may be joined to profile tables for a public feed response. */
export function publicAuthorUserIds(posts) {
  return [
    ...new Set(
      (posts || [])
        .filter((post) => !post.is_anonymous)
        .map((post) => post.user_id)
        .filter(Boolean),
    ),
  ];
}
