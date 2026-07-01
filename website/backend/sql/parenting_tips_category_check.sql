-- Parenting tips: allow hub browse categories (matches app + POST /api/tips).
-- Run in Supabase SQL editor after parenting_tips exists.

ALTER TABLE public.parenting_tips
  DROP CONSTRAINT IF EXISTS parenting_tips_category_check;

ALTER TABLE public.parenting_tips
  ADD CONSTRAINT parenting_tips_category_check
  CHECK (
    category IN (
      'child_development',
      'emotional_wellbeing',
      'behavior_guidance',
      'sleep',
      'autism_support',
      'screen_time',
      'positive_discipline',
      'social_skills',
      'parent_self_care',
      -- legacy values on older rows
      'general',
      'emotional_regulation',
      'communication',
      'routines'
    )
  );

COMMENT ON COLUMN public.parenting_tips.category IS
  'Hub browse category id (e.g. child_development) or legacy tip category.';
