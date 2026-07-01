-- Community anonymity hardening
-- Run once in Supabase SQL editor after community.sql
--
-- Architecture:
--   • community_posts.user_id is ALWAYS stored (moderation, deletion, reports, blocks).
--   • community_posts.is_anonymous controls whether the author identity is public.
--   • Mobile/web clients must use the backend API; it sanitizes author fields before responding.
--   • Admin/service-role queries may read user_id even when is_anonymous = true.

-- Ensure columns exist on legacy deployments
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.community_posts.user_id IS
  'Always retained for moderation and deletion. Omitted from public API payloads when is_anonymous is true.';

COMMENT ON COLUMN public.community_posts.is_anonymous IS
  'When true, public feed/detail responses must hide author display_name and profile_image_url.';

CREATE INDEX IF NOT EXISTS idx_community_posts_is_anonymous
  ON public.community_posts (is_anonymous);

-- Block direct table reads from authenticated clients (API uses service role).
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_posts_service_role_all ON public.community_posts;
CREATE POLICY community_posts_service_role_all
  ON public.community_posts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Parents may insert their own posts (user_id must match auth.uid()).
DROP POLICY IF EXISTS community_posts_parent_insert ON public.community_posts;
CREATE POLICY community_posts_parent_insert
  ON public.community_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authors may delete their own posts (moderation still has service_role access).
DROP POLICY IF EXISTS community_posts_author_delete ON public.community_posts;
CREATE POLICY community_posts_author_delete
  ON public.community_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
