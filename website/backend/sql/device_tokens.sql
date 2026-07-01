-- FCM / push notification device tokens.
-- Prefer this table over parents.push_token: multiple devices per user, therapists,
-- platform tracking, and safe upserts when tokens refresh.
-- Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.device_tokens (
  device_token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT device_tokens_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
  ON public.device_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_platform
  ON public.device_tokens (platform);

-- Keep updated_at fresh on token refresh (upsert from the app/backend).
CREATE OR REPLACE FUNCTION public.set_device_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS device_tokens_set_updated_at ON public.device_tokens;
CREATE TRIGGER device_tokens_set_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_device_tokens_updated_at();

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_select_own ON public.device_tokens;
CREATE POLICY device_tokens_select_own
  ON public.device_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_insert_own ON public.device_tokens;
CREATE POLICY device_tokens_insert_own
  ON public.device_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_update_own ON public.device_tokens;
CREATE POLICY device_tokens_update_own
  ON public.device_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_delete_own ON public.device_tokens;
CREATE POLICY device_tokens_delete_own
  ON public.device_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Optional: stop using the legacy single-token column on parents.
-- ALTER TABLE public.parents DROP COLUMN IF EXISTS push_token;
