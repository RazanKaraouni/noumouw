-- Align resource_saves with resource_likes (resources_id, parent_user_id).
-- Safe when the legacy table used id / resource_id / user_id (table may be empty).

BEGIN;

DROP TABLE IF EXISTS public.resource_saves CASCADE;

CREATE TABLE public.resource_saves (
  resource_save_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resources_id UUID NOT NULL REFERENCES public.resources (resources_id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resources_id, parent_user_id)
);

CREATE INDEX idx_resource_saves_parent
  ON public.resource_saves (parent_user_id);

CREATE INDEX idx_resource_saves_resource
  ON public.resource_saves (resources_id);

ALTER TABLE public.resource_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_saves_select_own ON public.resource_saves;
CREATE POLICY resource_saves_select_own
  ON public.resource_saves
  FOR SELECT
  TO authenticated
  USING (parent_user_id = auth.uid());

DROP POLICY IF EXISTS resource_saves_insert_own ON public.resource_saves;
CREATE POLICY resource_saves_insert_own
  ON public.resource_saves
  FOR INSERT
  TO authenticated
  WITH CHECK (parent_user_id = auth.uid());

DROP POLICY IF EXISTS resource_saves_delete_own ON public.resource_saves;
CREATE POLICY resource_saves_delete_own
  ON public.resource_saves
  FOR DELETE
  TO authenticated
  USING (parent_user_id = auth.uid());

COMMIT;
