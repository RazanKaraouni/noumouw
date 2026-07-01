-- Parent likes on therapist Learn resources (run in Supabase SQL editor).
CREATE TABLE IF NOT EXISTS public.resource_likes (
  resource_like_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resources_id UUID NOT NULL REFERENCES public.resources (resources_id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resources_id, parent_user_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_likes_parent
  ON public.resource_likes (parent_user_id);

CREATE INDEX IF NOT EXISTS idx_resource_likes_resource
  ON public.resource_likes (resources_id);
