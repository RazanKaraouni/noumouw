-- =============================================================================
-- 1. activity_library (parent discovery / filters by age band + domain)
-- =============================================================================

create table if not exists public.activity_library (
  activity_id uuid primary key default gen_random_uuid (),
  min_age_months integer not null check (min_age_months >= 0),
  max_age_months integer not null check (max_age_months >= min_age_months),
  domain text not null check (domain in ('speech','cognitive','motor','social')),
  title text not null,
  instructions text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_library_domain_age
  on public.activity_library (domain, min_age_months, max_age_months);

comment on table public.activity_library is 'Filtered development activities by age band (months) and domain.';


-- =============================================================================
-- 2. assignments (therapist assign → parent feedback → therapist reply)
--    child_id matches appointments.child_id → public.children(children_id)
-- =============================================================================

create table if not exists public.assignments (
  assignment_id uuid primary key default gen_random_uuid (),
  child_id integer not null references public.children (children_id) on delete cascade,
  therapist_id uuid not null references public.therapists (therapist_id) on delete cascade,
  title text not null,
  description text,
  domain text not null check (domain in ('speech','cognitive','motor','social')),
  status text not null default 'pending'
    check (status in ('pending','completed','incomplete')),
  parent_notes text,
  therapist_reply text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignments_child_created
  on public.assignments (child_id, created_at desc);

create index if not exists idx_assignments_therapist_created
  on public.assignments (therapist_id, created_at desc);

create index if not exists idx_assignments_needs_therapist_reply
  on public.assignments (child_id, therapist_id)
  where parent_notes is not null and therapist_reply is null;


-- Helper: therapist has any non-cancelled appointment for this child (caseload gate)
create or replace function public.therapist_has_child_appointment (
  p_therapist_id uuid,
  p_child_id integer
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    where a.therapist_id = p_therapist_id
      and a.child_id = p_child_id
      and coalesce(lower(a.status::text),'') <> 'cancelled'
  );
$$;


-- UPDATE guard: parents only touch status + parent_notes; therapists only therapist_reply
create or replace function public.assignments_enforce_note_permissions ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_parent boolean := exists (
    select 1
    from public.children c
    where c.children_id = new.child_id
      and c.parent_id = auth.uid()
  );
  v_is_therapist boolean := exists (
    select 1
    from public.therapists t
    where t.therapist_id = new.therapist_id
      and t.user_id = auth.uid()
  );
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if v_is_parent and not v_is_therapist then
    if new.assignment_id is distinct from old.assignment_id
       or new.child_id is distinct from old.child_id
       or new.therapist_id is distinct from old.therapist_id
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.domain is distinct from old.domain
       or new.therapist_reply is distinct from old.therapist_reply
       or new.created_at is distinct from old.created_at
    then
      raise exception 'Parents may only update status and parent_notes';
    end if;
  elsif v_is_therapist and not v_is_parent then
    if new.assignment_id is distinct from old.assignment_id
       or new.child_id is distinct from old.child_id
       or new.therapist_id is distinct from old.therapist_id
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.domain is distinct from old.domain
       or new.status is distinct from old.status
       or new.parent_notes is distinct from old.parent_notes
       or new.created_at is distinct from old.created_at
    then
      raise exception 'Therapists may only update therapist_reply';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assignments_enforce_note_permissions on public.assignments;

create trigger trg_assignments_enforce_note_permissions
before update on public.assignments
for each row
execute function public.assignments_enforce_note_permissions ();


-- =============================================================================
-- 3. Realtime (parents see therapist_reply as soon as it is written)
--    Idempotent: avoids ERROR 42710 if table is already in supabase_realtime
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'assignments'
  ) then
    alter publication supabase_realtime add table public.assignments;
  end if;
end $$;


-- =============================================================================
-- 4. Row Level Security
-- =============================================================================

alter table public.activity_library enable row level security;
alter table public.assignments enable row level security;

-- activity_library: any signed-in client can read the catalog
drop policy if exists activity_library_authenticated_select on public.activity_library;
create policy activity_library_authenticated_select
on public.activity_library
for select
to authenticated
using (true);

-- Assignments: parents see rows for their children
drop policy if exists assignments_parent_select on public.assignments;
create policy assignments_parent_select
on public.assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.children_id = assignments.child_id
      and c.parent_id = auth.uid()
  )
);

drop policy if exists assignments_parent_update on public.assignments;
create policy assignments_parent_update
on public.assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.children_id = assignments.child_id
      and c.parent_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.children c
    where c.children_id = assignments.child_id
      and c.parent_id = auth.uid()
  )
);

-- Assignments: therapist sees / inserts / replies only within caseload (appointments link)
drop policy if exists assignments_therapist_select on public.assignments;
create policy assignments_therapist_select
on public.assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.therapists t
    where t.therapist_id = assignments.therapist_id
      and t.user_id = auth.uid()
      and public.therapist_has_child_appointment (t.therapist_id, assignments.child_id)
  )
);

drop policy if exists assignments_therapist_insert on public.assignments;
create policy assignments_therapist_insert
on public.assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.therapists t
    where t.therapist_id = assignments.therapist_id
      and t.user_id = auth.uid()
      and public.therapist_has_child_appointment (t.therapist_id, assignments.child_id)
  )
);

drop policy if exists assignments_therapist_update on public.assignments;
create policy assignments_therapist_update
on public.assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.therapists t
    where t.therapist_id = assignments.therapist_id
      and t.user_id = auth.uid()
      and public.therapist_has_child_appointment (t.therapist_id, assignments.child_id)
  )
)
with check (
  exists (
    select 1
    from public.therapists t
    where t.therapist_id = assignments.therapist_id
      and t.user_id = auth.uid()
      and public.therapist_has_child_appointment (t.therapist_id, assignments.child_id)
  )
);
