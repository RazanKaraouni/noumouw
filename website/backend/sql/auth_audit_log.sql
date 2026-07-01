-- Auth events go into public.audit_log (event_type auth_*). Run once in Supabase SQL editor.

-- 1) Migrate old auth_audit_log rows if that table was created earlier (safe if it never existed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'auth_audit_log'
  ) THEN
    EXECUTE $migrate$
      INSERT INTO public.audit_log (event_type, actor_id, target_table, target_id, metadata, created_at)
      SELECT
        'auth_' || outcome,
        CASE
          WHEN user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN user_id::uuid
          ELSE NULL
        END,
        'auth',
        user_id,
        jsonb_build_object(
          'outcome', outcome,
          'ip_address', ip_address,
          'details', details
        ),
        created_at
      FROM public.auth_audit_log
    $migrate$;
    DROP TABLE public.auth_audit_log;
  END IF;
END $$;

-- 2) Index for auth audit queries
CREATE INDEX IF NOT EXISTS audit_log_auth_events_idx
  ON public.audit_log (created_at DESC)
  WHERE event_type IN (
    'auth_success',
    'auth_failed_password',
    'auth_suspended',
    'auth_invalid_token'
  );

COMMENT ON TABLE public.audit_log IS
  'Moderation and authentication audit. Auth rows use event_type auth_*; ip/outcome live in metadata.';
