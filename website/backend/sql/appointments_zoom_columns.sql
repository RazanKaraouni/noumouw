-- Zoom meeting fields on Supabase appointments (created when therapist confirms).
-- Run once in Supabase SQL editor.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS zoom_join_url TEXT,
  ADD COLUMN IF NOT EXISTS zoom_password TEXT,
  ADD COLUMN IF NOT EXISTS zoom_start_url TEXT,
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;

COMMENT ON COLUMN public.appointments.zoom_join_url IS 'Parent join URL from Zoom API.';
COMMENT ON COLUMN public.appointments.zoom_start_url IS 'Host start URL for therapist.';
COMMENT ON COLUMN public.appointments.zoom_meeting_id IS 'Zoom meeting id string.';
