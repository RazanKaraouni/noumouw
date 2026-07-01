-- Therapist invite: set-password link after join request approval
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS password_setup_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_setup_expires_at TIMESTAMPTZ;
