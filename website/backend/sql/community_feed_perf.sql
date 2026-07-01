-- Community feed performance (aligned with production schema).
-- Safe to re-run. Apply with:
--   node scripts/applySqlMigration.js sql/community_feed_perf.sql

-- Replace older 5-argument overload so PostgREST resolves one signature.
DROP FUNCTION IF EXISTS public.community_feed(uuid, text, text, int, int);

CREATE OR REPLACE FUNCTION public.community_feed(
  p_viewer_id uuid,
  p_age_category text DEFAULT NULL,
  p_developmental_category text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS SETOF public.community_posts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.community_posts p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.community_blocked_users bu
    WHERE bu.blocker_id = p_viewer_id
      AND bu.blocked_user_id = p.user_id
  )
  AND (
    p_exclude_user_id IS NULL
    OR p.user_id <> p_exclude_user_id
  )
  AND (
    p_age_category IS NULL
    OR btrim(p_age_category) = ''
    OR p.age_category = p_age_category
  )
  AND (
    p_developmental_category IS NULL
    OR btrim(p_developmental_category) = ''
    OR p.developmental_category = p_developmental_category
  )
  ORDER BY p.created_at DESC
  LIMIT greatest(p_limit, 1)
  OFFSET greatest(p_offset, 0);
$$;

-- Batch like/comment/saved/specialist stats for a page of posts (one round trip).
CREATE OR REPLACE FUNCTION public.community_post_engagement(
  p_post_ids uuid[],
  p_viewer_id uuid
)
RETURNS TABLE (
  post_id uuid,
  like_count bigint,
  comment_count bigint,
  is_liked boolean,
  is_saved boolean,
  specialist_responded boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.pid AS post_id,
    COALESCE(l.cnt, 0::bigint) AS like_count,
    COALESCE(c.cnt, 0::bigint) AS comment_count,
    EXISTS (
      SELECT 1
      FROM public.community_likes lk
      WHERE lk.post_id = p.pid
        AND lk.user_id = p_viewer_id
    ) AS is_liked,
    EXISTS (
      SELECT 1
      FROM public.community_saved_posts sp
      WHERE sp.post_id = p.pid
        AND sp.user_id = p_viewer_id
    ) AS is_saved,
    EXISTS (
      SELECT 1
      FROM public.community_comments cm
      INNER JOIN public.therapists t ON t.user_id = cm.user_id
      WHERE cm.post_id = p.pid
    ) AS specialist_responded
  FROM unnest(COALESCE(p_post_ids, ARRAY[]::uuid[])) AS p(pid)
  LEFT JOIN (
    SELECT lk.post_id, COUNT(*)::bigint AS cnt
    FROM public.community_likes lk
    WHERE lk.post_id = ANY (COALESCE(p_post_ids, ARRAY[]::uuid[]))
    GROUP BY lk.post_id
  ) l ON l.post_id = p.pid
  LEFT JOIN (
    SELECT cm.post_id, COUNT(*)::bigint AS cnt
    FROM public.community_comments cm
    WHERE cm.post_id = ANY (COALESCE(p_post_ids, ARRAY[]::uuid[]))
    GROUP BY cm.post_id
  ) c ON c.post_id = p.pid;
$$;

CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
  ON public.community_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_user_created_at
  ON public.community_posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_age_category
  ON public.community_posts (age_category);

CREATE INDEX IF NOT EXISTS idx_community_posts_developmental_category
  ON public.community_posts (developmental_category);

CREATE INDEX IF NOT EXISTS idx_community_likes_post_id
  ON public.community_likes (post_id);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_id
  ON public.community_comments (post_id);

CREATE INDEX IF NOT EXISTS idx_community_blocked_users_blocker
  ON public.community_blocked_users (blocker_id);

CREATE INDEX IF NOT EXISTS idx_community_saved_posts_user_post
  ON public.community_saved_posts (user_id, post_id);

GRANT EXECUTE ON FUNCTION public.community_feed(uuid, text, text, int, int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.community_post_engagement(uuid[], uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
