-- =============================================================================
-- Schema cleanup: unused tables & columns (noumouw production)
-- =============================================================================
-- Run in Supabase SQL Editor on a BACKUP / staging project first.
--
-- What this removes (based on website/ + noumouw_app/ code audit):
--   • Unused tables: therapist_join_requests, chat_typing_state
--   • Unused view:  milestone_cdc_age_label
--   • Unused columns on otherwise-active tables (see section 2)
--
-- NOT removed (still used somewhere):
--   • activity_library  — admin website
--   • announcements     — admin website
--   • automation_rules / notification_log — optional section 3 only
--
-- After running section 3, update adminLogsController.js (automation log tab).
-- After dropping chat_typing_state, remove realtime subscribe in ChatPage.jsx.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Drop unused view
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.milestone_cdc_age_label;


-- -----------------------------------------------------------------------------
-- 2) Drop unused columns (safe IF EXISTS via information_schema)
-- -----------------------------------------------------------------------------

-- appointments.outcome_score — never read/written by app
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'outcome_score'
  ) THEN
    ALTER TABLE public.appointments DROP COLUMN outcome_score;
  END IF;
END $$;

-- therapists.availability_status — never used
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'therapists' AND column_name = 'availability_status'
  ) THEN
    ALTER TABLE public.therapists DROP COLUMN availability_status;
  END IF;
END $$;

-- therapists.rating — selected in admin list but never displayed or updated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'therapists' AND column_name = 'rating'
  ) THEN
    ALTER TABLE public.therapists DROP COLUMN rating;
  END IF;
END $$;

-- children.child_uuid — duplicate of child_id; app uses children_id + child_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'children' AND column_name = 'child_uuid'
  ) THEN
    ALTER TABLE public.children DROP COLUMN child_uuid;
  END IF;
END $$;

-- clinics.description — nearby map API never selects it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinics' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.clinics DROP COLUMN description;
  END IF;
END $$;

-- reports.admin_id — migration added it; app never reads/writes it
DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'admin_id'
  ) THEN
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = 'public.reports'::regclass
        AND c.contype = 'f'
        AND pg_get_constraintdef(c.oid) ILIKE '%admin_id%'
    LOOP
      EXECUTE format('ALTER TABLE public.reports DROP CONSTRAINT %I', r.conname);
    END LOOP;
    ALTER TABLE public.reports DROP COLUMN admin_id;
  END IF;
END $$;

-- child_milestones denormalized / unused columns (app uses target_age_months only)
DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'child_milestones' AND column_name = 'parent_id'
  ) THEN
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = 'public.child_milestones'::regclass
        AND c.contype = 'f'
        AND pg_get_constraintdef(c.oid) ILIKE '%parent_id%'
    LOOP
      EXECUTE format('ALTER TABLE public.child_milestones DROP CONSTRAINT %I', r.conname);
    END LOOP;
    ALTER TABLE public.child_milestones DROP COLUMN parent_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'child_milestones' AND column_name = 'parent_name'
  ) THEN
    ALTER TABLE public.child_milestones DROP COLUMN parent_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'child_milestones' AND column_name = 'age_months_min'
  ) THEN
    ALTER TABLE public.child_milestones DROP COLUMN age_months_min;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'child_milestones' AND column_name = 'age_months_max'
  ) THEN
    ALTER TABLE public.child_milestones DROP COLUMN age_months_max;
  END IF;
END $$;

-- screening_results.total_score — app falls back to score; drop if someone added this column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'screening_results' AND column_name = 'total_score'
  ) THEN
    ALTER TABLE public.screening_results DROP COLUMN total_score;
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 3) Drop dead chat typing table (subscribed in UI but nothing writes rows)
--    Skipped entirely if the table was never created in this project.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'chat_typing_state'
  ) THEN
    RAISE NOTICE 'Skipping chat_typing_state — table does not exist.';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "typing_state_participants_rw" ON public.chat_typing_state';

  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_typing_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_typing_state;
  END IF;

  DROP INDEX IF EXISTS public.idx_chat_typing_state_room_updated;
  DROP TABLE public.chat_typing_state;

  RAISE NOTICE 'Dropped public.chat_typing_state.';
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN OTHERS THEN
    IF SQLERRM ILIKE '%is not part of%' OR SQLERRM ILIKE '%does not exist%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 4) Drop unused therapist join-requests table (no app routes)
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.therapist_join_requests_pending_email_idx;
DROP TABLE IF EXISTS public.therapist_join_requests;


COMMIT;


-- =============================================================================
-- OPTIONAL — automation stack (uncomment ONLY if you will NOT deploy edge function)
-- Breaks Admin → Logs → automation / notification log tabs until code is updated.
-- =============================================================================
/*
BEGIN;

DROP POLICY IF EXISTS notification_log_update ON public.notification_log;
DROP POLICY IF EXISTS notification_log_insert ON public.notification_log;
DROP POLICY IF EXISTS notification_log_select ON public.notification_log;

DROP POLICY IF EXISTS automation_rules_delete ON public.automation_rules;
DROP POLICY IF EXISTS automation_rules_update ON public.automation_rules;
DROP POLICY IF EXISTS automation_rules_insert ON public.automation_rules;
DROP POLICY IF EXISTS automation_rules_select ON public.automation_rules;

DROP INDEX IF EXISTS public.notification_log_child_idx;
DROP INDEX IF EXISTS public.notification_log_sent_at_idx;
DROP INDEX IF EXISTS public.notification_log_rule_sent_idx;

DROP TABLE IF EXISTS public.notification_log;
DROP TABLE IF EXISTS public.automation_rules;

DROP INDEX IF EXISTS public.automation_rules_unique_per_child;
DROP INDEX IF EXISTS public.automation_rules_unique_all_children;

DROP TYPE IF EXISTS public.notification_delivery_status;
DROP TYPE IF EXISTS public.notification_channel;
DROP TYPE IF EXISTS public.automation_rule_type;

COMMIT;
*/


-- =============================================================================
-- Verify (run separately after commit)
-- =============================================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('therapist_join_requests', 'chat_typing_state', 'milestone_cdc_age_label');
--
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND (
--     (table_name = 'appointments' AND column_name = 'outcome_score')
--     OR (table_name = 'therapists' AND column_name IN ('availability_status', 'rating'))
--     OR (table_name = 'children' AND column_name = 'child_uuid')
--     OR (table_name = 'clinics' AND column_name = 'description')
--     OR (table_name = 'reports' AND column_name = 'admin_id')
--     OR (table_name = 'child_milestones' AND column_name IN ('parent_id', 'parent_name', 'age_months_min', 'age_months_max'))
--   );
