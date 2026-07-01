-- Extend resource_reports for parenting tip reports.
-- Run the FULL script top-to-bottom in Supabase SQL editor (parenting_tips must exist).

-- 1) Column on resource_reports (required before the foreign key)
ALTER TABLE public.resource_reports
  ADD COLUMN IF NOT EXISTS tip_id uuid;

-- 2) Allow target_type = 'tip' (drop any existing target_type check on this table)
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
    EXECUTE format(
      'ALTER TABLE public.resource_reports DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.resource_reports
  ADD CONSTRAINT resource_reports_target_type_check
  CHECK (
    target_type = ANY (
      ARRAY['resource'::text, 'post'::text, 'comment'::text, 'tip'::text]
    )
  );

-- 3) FK only when both tables expose tip_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resource_reports'
      AND column_name = 'tip_id'
  ) THEN
    RAISE EXCEPTION
      'resource_reports.tip_id is missing. Re-run step 1 (ADD COLUMN) first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parenting_tips'
      AND column_name = 'tip_id'
  ) THEN
    RAISE EXCEPTION
      'parenting_tips.tip_id is missing. Create parenting_tips before this migration.';
  END IF;

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
