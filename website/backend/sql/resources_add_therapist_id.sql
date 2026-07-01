-- Add therapist_id to resources and backfill from therapist_name.
-- Run in Supabase SQL editor after resources and therapists tables exist.
-- Safe to run once; skips if the column already exists.

alter table public.resources
  add column if not exists therapist_id uuid;

update public.resources r
set therapist_id = t.therapist_id
from public.therapists t
where r.therapist_id is null
  and r.therapist_name is not null
  and trim(r.therapist_name) <> ''
  and t.full_name = r.therapist_name;

create index if not exists resources_therapist_id_idx
  on public.resources (therapist_id);

-- Optional FK (run resources_therapist_fkey.sql after this if you want cascade deletes).

notify pgrst, 'reload schema';
