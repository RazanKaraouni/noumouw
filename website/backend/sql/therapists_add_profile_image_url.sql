-- Add profile_image_url to therapists for directory, booking, and community author avatars.
-- Run in Supabase SQL editor once. Safe to re-run.

alter table public.therapists
  add column if not exists profile_image_url text;

comment on column public.therapists.profile_image_url is
  'Public avatar URL for therapist directory and community specialist badge.';

notify pgrst, 'reload schema';
