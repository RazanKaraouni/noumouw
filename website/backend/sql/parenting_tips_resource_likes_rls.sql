-- RLS for mobile app direct Supabase reads (parenting tips + resource likes).
-- Run in Supabase SQL editor after parenting_tips and resource_likes exist.

ALTER TABLE public.parenting_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parenting_tips_select_approved ON public.parenting_tips;
CREATE POLICY parenting_tips_select_approved
  ON public.parenting_tips
  FOR SELECT
  TO authenticated
  USING (status = 'approved');

ALTER TABLE public.resource_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_likes_select_own ON public.resource_likes;
CREATE POLICY resource_likes_select_own
  ON public.resource_likes
  FOR SELECT
  TO authenticated
  USING (parent_user_id = auth.uid());

DROP POLICY IF EXISTS resource_likes_insert_own ON public.resource_likes;
CREATE POLICY resource_likes_insert_own
  ON public.resource_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (parent_user_id = auth.uid());

DROP POLICY IF EXISTS resource_likes_delete_own ON public.resource_likes;
CREATE POLICY resource_likes_delete_own
  ON public.resource_likes
  FOR DELETE
  TO authenticated
  USING (parent_user_id = auth.uid());
