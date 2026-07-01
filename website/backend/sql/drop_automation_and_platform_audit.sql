-- Drop therapist automation tables only (audit_log writes stay in the backend).

DROP POLICY IF EXISTS notification_log_update ON public.notification_log;DROP POLICY IF EXISTS notification_log_insert ON public.notification_log;
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

NOTIFY pgrst, 'reload schema';
