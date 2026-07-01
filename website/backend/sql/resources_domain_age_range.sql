-- Run in Supabase SQL editor when the therapist dashboard collects domain + age range per resource.
-- Safe to run once; skips if columns already exist.

alter table public.resources add column if not exists domain text;
alter table public.resources add column if not exists age_range text;
