-- Community feature — extends existing community_posts / community_comments.
-- Uses resource_reports for moderation (same queue as adminModeration).
-- Run once in Supabase SQL editor.
--
-- Anonymity model:
--   user_id is always persisted on community_posts for moderation/deletion.
--   is_anonymous toggles whether the author name/avatar are exposed to clients.
--   Feed/detail APIs sanitize responses; see backend/utils/communityAnonymity.js.
--   After this file, run community_anonymity_rls.sql to lock down direct client reads.

-- Extend community_posts (already exists)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_category varchar(50) NOT NULL DEFAULT '0-2',
  ADD COLUMN IF NOT EXISTS developmental_category varchar(50),
  ADD COLUMN IF NOT EXISTS locale_tag varchar(120),
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_community_posts_developmental_category
  ON public.community_posts (developmental_category);

CREATE INDEX IF NOT EXISTS idx_community_posts_age_category
  ON public.community_posts (age_category);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
  ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_hashtags
  ON public.community_posts USING gin (hashtags);

-- Likes (one per user per post)
CREATE TABLE IF NOT EXISTS public.community_likes (
  like_id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts (post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_likes_pkey PRIMARY KEY (like_id),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_likes_post_id ON public.community_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_created_at ON public.community_likes (created_at DESC);

-- Saved posts
CREATE TABLE IF NOT EXISTS public.community_saved_posts (
  saved_id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts (post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_saved_posts_pkey PRIMARY KEY (saved_id),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_saved_posts_user
  ON public.community_saved_posts (user_id, created_at DESC);

-- Blocked users (hide author from viewer feed)
CREATE TABLE IF NOT EXISTS public.community_blocked_users (
  block_id uuid NOT NULL DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_blocked_users_pkey PRIMARY KEY (block_id),
  UNIQUE (blocker_id, blocked_user_id),
  CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_blocked_users_blocker
  ON public.community_blocked_users (blocker_id);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_id
  ON public.community_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_created_at
  ON public.community_comments (created_at DESC);

-- Feed with block exclusion
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
  WHERE p.user_id NOT IN (
    SELECT bu.blocked_user_id
    FROM public.community_blocked_users bu
    WHERE bu.blocker_id = p_viewer_id
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

-- Trending: likes (×2) + comments (×3) in past 24 hours
CREATE OR REPLACE FUNCTION public.community_trending_posts(
  p_viewer_id uuid,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  post_id uuid,
  user_id uuid,
  is_anonymous boolean,
  age_category varchar(50),
  content text,
  image_url text,
  hashtags text[],
  created_at timestamptz,
  updated_at timestamptz,
  trend_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.post_id,
    p.user_id,
    p.is_anonymous,
    p.age_category,
    p.content,
    p.image_url,
    p.hashtags,
    p.created_at,
    p.updated_at,
    (COALESCE(l.cnt, 0) * 2 + COALESCE(c.cnt, 0) * 3)::numeric AS trend_score
  FROM public.community_posts p
  LEFT JOIN (
    SELECT lk.post_id, COUNT(*)::int AS cnt
    FROM public.community_likes lk
    WHERE lk.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY lk.post_id
  ) l ON l.post_id = p.post_id
  LEFT JOIN (
    SELECT cm.post_id, COUNT(*)::int AS cnt
    FROM public.community_comments cm
    WHERE cm.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY cm.post_id
  ) c ON c.post_id = p.post_id
  WHERE p.user_id NOT IN (
    SELECT bu.blocked_user_id
    FROM public.community_blocked_users bu
    WHERE bu.blocker_id = p_viewer_id
  )
  AND p.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY trend_score DESC, p.created_at DESC
  LIMIT greatest(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.community_feed(uuid, text, text, int, int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.community_trending_posts(uuid, int) TO service_role;

NOTIFY pgrst, 'reload schema';
