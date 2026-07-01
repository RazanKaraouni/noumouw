-- Therapist specializations (profession / specialty tags)
-- Run in Supabase SQL editor.

create table if not exists public.therapist_specializations (
  specialization_id bigserial primary key,
  specialization_name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists therapist_specializations_name_key
  on public.therapist_specializations (lower(trim(specialization_name)));

create or replace function public.set_therapist_specializations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists therapist_specializations_updated_at on public.therapist_specializations;
create trigger therapist_specializations_updated_at
  before update on public.therapist_specializations
  for each row execute function public.set_therapist_specializations_updated_at();

alter table public.therapist_specializations enable row level security;

drop policy if exists therapist_specializations_select_authenticated on public.therapist_specializations;
create policy therapist_specializations_select_authenticated
  on public.therapist_specializations
  for select
  to authenticated
  using (true);

-- Seed common specialties (safe to re-run: skips duplicates by name)
insert into public.therapist_specializations (specialization_name, description)
select v.name, v.description
from (
  values
    ('Speech Therapist', 'Assessment and therapy for speech, language, and communication.'),
    ('Psychomotor Therapist', 'Motor development, coordination, and sensory-motor integration.'),
    ('Occupational Therapist', 'Daily living skills, fine motor, and sensory processing.'),
    ('Pediatrician', 'Medical care and developmental screening for children.'),
    ('Psychologist', 'Emotional, behavioral, and developmental support.'),
    ('Special Education Teacher', 'Individualized learning and educational strategies.')
) as v(name, description)
where not exists (
  select 1
  from public.therapist_specializations s
  where lower(trim(s.specialization_name)) = lower(trim(v.name))
);
