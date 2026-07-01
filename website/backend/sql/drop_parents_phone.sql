-- Remove parent phone number (no longer collected at signup).
-- Run in Supabase SQL editor if not applied via supabase/migrations.

ALTER TABLE public.parents DROP COLUMN IF EXISTS phone;
