-- Links resources.therapist_id to therapists so Supabase can join/embed therapist data.
-- Safe to run once; skips if the constraint already exists.
-- Run in Supabase SQL editor after resources and therapists tables exist.

-- Remove rows with missing therapist links before adding the FK (optional cleanup).
delete from public.resources r
where r.therapist_id is not null
  and not exists (
    select 1
    from public.therapists t
    where t.therapist_id = r.therapist_id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resources_therapist_id_fkey'
  ) then
    alter table public.resources
      add constraint resources_therapist_id_fkey
      foreign key (therapist_id)
      references public.therapists (therapist_id)
      on delete cascade;
  end if;
end $$;

-- Refresh PostgREST schema cache so embed joins work immediately.
notify pgrst, 'reload schema';
