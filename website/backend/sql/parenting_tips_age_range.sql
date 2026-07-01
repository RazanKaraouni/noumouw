-- Parenting tips: store age range as free text (e.g. "0-12 months", "3-5 years").
-- Replaces age_min_months / age_max_months. Run in Supabase SQL editor.

ALTER TABLE public.parenting_tips
  ADD COLUMN IF NOT EXISTS age_range text;

-- Migrate existing month-based ranges to text labels.
UPDATE public.parenting_tips
SET age_range = CASE
  WHEN age_min_months IS NULL AND age_max_months IS NULL THEN NULL
  WHEN age_min_months = 0 AND age_max_months = 12 THEN '0-12 months'
  WHEN age_min_months = 12 AND age_max_months = 36 THEN '1-3 years'
  WHEN age_min_months = 36 AND age_max_months = 60 THEN '3-5 years'
  WHEN age_min_months = 60 AND age_max_months = 96 THEN '5-8 years'
  WHEN age_min_months = 96 AND age_max_months = 144 THEN '8-12 years'
  WHEN age_min_months = 144 AND age_max_months IS NULL THEN '12+ years'
  WHEN age_max_months IS NULL THEN age_min_months::text || '+ months'
  ELSE age_min_months::text || '-' || age_max_months::text || ' months'
END
WHERE age_range IS NULL
  AND (age_min_months IS NOT NULL OR age_max_months IS NOT NULL);

DROP INDEX IF EXISTS parenting_tips_age_range_idx;

ALTER TABLE public.parenting_tips
  DROP CONSTRAINT IF EXISTS parenting_tips_age_range_check;

ALTER TABLE public.parenting_tips
  DROP COLUMN IF EXISTS age_min_months,
  DROP COLUMN IF EXISTS age_max_months;

COMMENT ON COLUMN public.parenting_tips.age_range IS
  'Free-text child age range for the tip (e.g. "0-12 months", "3-5 years"). Must include a number when set.';

CREATE INDEX IF NOT EXISTS parenting_tips_age_range_idx
  ON public.parenting_tips (age_range);
