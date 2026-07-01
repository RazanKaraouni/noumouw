-- Admin dashboard alignment (run once in Supabase SQL editor).
-- Adds admins.full_name, ensures moderation_status includes resolved,
-- and keeps full_name in sync with first_name + last_name.

-- -----------------------------------------------------------------------------
-- 1. admins.full_name (login, settings, moderation log)
-- -----------------------------------------------------------------------------
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS full_name text;

UPDATE public.admins
SET full_name = TRIM(CONCAT(first_name, ' ', last_name))
WHERE (full_name IS NULL OR TRIM(full_name) = '')
  AND (first_name IS NOT NULL OR last_name IS NOT NULL);

UPDATE public.admins
SET full_name = SPLIT_PART(email, '@', 1)
WHERE (full_name IS NULL OR TRIM(full_name) = '')
  AND email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_admins_full_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.full_name IS NULL OR TRIM(NEW.full_name) = '' THEN
    NEW.full_name := NULLIF(TRIM(CONCAT(NEW.first_name, ' ', NEW.last_name)), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admins_sync_full_name ON public.admins;

CREATE TRIGGER admins_sync_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name, full_name
  ON public.admins
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admins_full_name();

COMMENT ON COLUMN public.admins.full_name IS
  'Display name for admin console (settings, moderation log). Backfilled from first_name + last_name.';

-- -----------------------------------------------------------------------------
-- 2. moderation_status: add resolved (report queue writes this on resolve)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'moderation_status'
      AND e.enumlabel = 'resolved'
  ) THEN
    ALTER TYPE public.moderation_status ADD VALUE 'resolved';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. resource_reports: ensure tip target type + tip_id (report queue / tips)
-- -----------------------------------------------------------------------------
ALTER TABLE public.resource_reports
  ADD COLUMN IF NOT EXISTS tip_id uuid;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.resource_reports'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.resource_reports DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.resource_reports
  ADD CONSTRAINT resource_reports_target_type_check
  CHECK (
    target_type = ANY (
      ARRAY['resource'::text, 'post'::text, 'comment'::text, 'tip'::text]
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'resource_reports_tip_id_fkey'
      AND conrelid = 'public.resource_reports'::regclass
  ) THEN
    ALTER TABLE public.resource_reports
      ADD CONSTRAINT resource_reports_tip_id_fkey
      FOREIGN KEY (tip_id)
      REFERENCES public.parenting_tips (tip_id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS resource_reports_tip_id_idx
  ON public.resource_reports (tip_id);

-- -----------------------------------------------------------------------------
-- 4. parents suspension index (admin filters / moderation)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS parents_is_suspended_idx
  ON public.parents (is_suspended)
  WHERE is_suspended = true;
