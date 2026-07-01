-- Optional: add denormalized parent_id on screening_results (e.g. for RLS or simpler queries).
-- Run in Supabase SQL editor if you want the Flutter app to send parent_id again.

alter table public.screening_results
add column if not exists parent_id uuid references auth.users (id) on delete cascade;

create index if not exists screening_results_parent_id_idx on public.screening_results (parent_id);
