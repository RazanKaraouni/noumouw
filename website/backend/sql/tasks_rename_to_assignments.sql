-- Run if you created public.tasks and want public.assignments (or to fix/reapply RLS + trigger).
-- Safe to re-run.
-- If BOTH public.tasks and public.assignments exist: copies rows (task_id → assignment_id, same UUID),
-- skips rows whose id is already in assignments, removes tasks from supabase_realtime, drops tasks,
-- then continues with triggers / policies on assignments only.

-- ---------------------------------------------------------------------------
-- 0. Drop old trigger/function (both table names, in case of partial migration)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_tasks_enforce_note_permissions on public.tasks;
drop trigger if exists trg_tasks_enforce_note_permissions on public.assignments;
drop trigger if exists trg_assignments_enforce_note_permissions on public.assignments;
drop function if exists public.tasks_enforce_note_permissions ();

-- ---------------------------------------------------------------------------
-- 1a. Both tasks + assignments exist: copy missing rows then drop tasks
--     Same UUID preserved: task_id -> assignment_id. Skips rows already in assignments.
-- ---------------------------------------------------------------------------
do $$
declare
  v_pub boolean;
begin
  if to_regclass('public.tasks') is null or to_regclass('public.assignments') is null then
    return;
  end if;

  insert into public.assignments (
    assignment_id,
    child_id,
    therapist_id,
    title,
    description,
    domain,
    status,
    parent_notes,
    therapist_reply,
    created_at
  )
  select
    t.task_id,
    t.child_id,
    t.therapist_id,
    t.title,
    t.description,
    t.domain,
    t.status,
    t.parent_notes,
    t.therapist_reply,
    t.created_at
  from public.tasks t
  where not exists (
    select 1 from public.assignments a where a.assignment_id = t.task_id
  );

  select exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  )
  into v_pub;

  if v_pub then
    execute 'alter publication supabase_realtime drop table public.tasks';
  end if;

  drop table public.tasks cascade;
end $$;

-- ---------------------------------------------------------------------------
-- 1b. Only tasks exists: rename whole table -> assignments
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.tasks') is not null and to_regclass('public.assignments') is null then
    alter table public.tasks rename to assignments;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Rename PK column only when task_id still exists
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignments'
      and column_name = 'task_id'
  ) then
    alter table public.assignments rename column task_id to assignment_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Indexes (rename only if old names exist and new names are free)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'idx_tasks_child_created')
     and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'idx_assignments_child_created')
  then
    alter index public.idx_tasks_child_created rename to idx_assignments_child_created;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'idx_tasks_therapist_created')
     and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'idx_assignments_therapist_created')
  then
    alter index public.idx_tasks_therapist_created rename to idx_assignments_therapist_created;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'idx_tasks_needs_therapist_reply')
     and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'idx_assignments_needs_therapist_reply')
  then
    alter index public.idx_tasks_needs_therapist_reply rename to idx_assignments_needs_therapist_reply;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Trigger + function (permission guard)
-- ---------------------------------------------------------------------------
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

do $$
begin
  if to_regclass('public.assignments') is null then
    raise exception 'public.assignments does not exist. Create it (e.g. activity_library_assignments.sql) or restore public.tasks.';
  end if;
end $$;

drop trigger if exists trg_assignments_enforce_note_permissions on public.assignments;

create trigger trg_assignments_enforce_note_permissions
before update on public.assignments
for each row
execute function public.assignments_enforce_note_permissions ();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security — replace policies (safe re-run)
-- ---------------------------------------------------------------------------
alter table public.assignments enable row level security;

drop policy if exists tasks_parent_select on public.assignments;
drop policy if exists tasks_parent_update on public.assignments;
drop policy if exists tasks_therapist_select on public.assignments;
drop policy if exists tasks_therapist_insert on public.assignments;
drop policy if exists tasks_therapist_update on public.assignments;

drop policy if exists assignments_parent_select on public.assignments;
drop policy if exists assignments_parent_update on public.assignments;
drop policy if exists assignments_therapist_select on public.assignments;
drop policy if exists assignments_therapist_insert on public.assignments;
drop policy if exists assignments_therapist_update on public.assignments;

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

-- ---------------------------------------------------------------------------
-- 6. Realtime
--    RENAME preserves publication OID. If assignments was created fresh, add:
-- ---------------------------------------------------------------------------
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
