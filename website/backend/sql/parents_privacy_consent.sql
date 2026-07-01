-- Parent privacy consent captured at signup (run once in Supabase SQL editor).

ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS accepted_privacy_policy boolean NOT NULL DEFAULT false;

ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

COMMENT ON COLUMN public.parents.accepted_privacy_policy IS
  'Parent agreed to Privacy Policy and child data collection at signup.';

COMMENT ON COLUMN public.parents.accepted_at IS
  'Timestamp when privacy consent was recorded.';
