-- public.reports (reference — table already exists in Noumouw production).
-- PK: report_id (uuid). child_id → children.children_id (integer). admin_id → admins.admin_id (integer).
-- Backend uses reportPrimaryKey() in screeningFeedback.js (report_id | reports_id | id).

-- Optional indexes (safe to run if missing):
CREATE INDEX IF NOT EXISTS reports_child_id_idx ON public.reports (child_id);
CREATE INDEX IF NOT EXISTS reports_parent_id_idx ON public.reports (parent_id);
CREATE INDEX IF NOT EXISTS reports_report_type_idx ON public.reports (report_type);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports (created_at DESC);

-- Widen report_type if an older CHECK omitted therapist_activity / financial_report:
-- ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_report_type_check;
-- ALTER TABLE public.reports ADD CONSTRAINT reports_report_type_check CHECK (
--   report_type = ANY (ARRAY[
--     'screening_summary'::text,
--     'milestone_tracking'::text,
--     'financial_report'::text,
--     'therapist_activity'::text
--   ])
-- );
