-- Add human-readable titles and optional admin assignment for public.reports.
-- Run once in Supabase SQL editor if the table already exists without these columns.
-- Production: admin_id is integer referencing public.admins(admin_id).

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS title text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reports'
      AND column_name = 'admin_id'
  ) THEN
    ALTER TABLE public.reports
      ADD COLUMN admin_id integer REFERENCES public.admins (admin_id);
  END IF;
END $$;

COMMENT ON COLUMN public.reports.title IS 'Short label for admin list views (e.g. Milestone Report: Name - Date).';
COMMENT ON COLUMN public.reports.admin_id IS 'Set when an admin claims/reviews the report; null until then.';
