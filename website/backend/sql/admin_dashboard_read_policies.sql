-- Optional: allow admin dashboard direct Supabase reads (anon key) on reference tables.
-- Only run if you want the frontend adminSupabaseModel path without API fallback.
-- Safer default: keep RLS strict and use Express + service role (current fallback).

-- Example (adjust to your security model):
-- CREATE POLICY milestones_admin_read ON public.milestones FOR SELECT USING (true);
