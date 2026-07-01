-- Admin logs (safe for existing Noumouw schema — run once in Supabase SQL editor).
-- user_warnings may use PK column "id" and admin_id integer (matches public.admins).

ALTER TABLE public.user_warnings
  ADD COLUMN IF NOT EXISTS report_id uuid
    REFERENCES public.resource_reports (report_id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_warnings'
      AND column_name = 'admin_id'
  ) THEN
    ALTER TABLE public.user_warnings
      ADD COLUMN admin_id integer REFERENCES public.admins (admin_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_warnings_admin_idx ON public.user_warnings (admin_id);
