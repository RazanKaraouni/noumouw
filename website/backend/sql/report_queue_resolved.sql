-- Report queue: add "resolved" to moderation_status (run once in Supabase SQL editor).
-- Do NOT recreate user_warnings here — production uses PK column "id" (uuid),
-- admin_id integer, and report_id uuid. See admin_logs_tables.sql for optional columns/indexes.

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
