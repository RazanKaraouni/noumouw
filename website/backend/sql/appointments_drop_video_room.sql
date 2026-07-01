-- Remove legacy video_room_id from Supabase appointments (online sessions use Zoom via /api/appointments).
-- Run once in Supabase SQL editor.

ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS video_room_id;
