-- Row-level security for child_milestones (parent-facing Flutter app).
-- Error: PostgrestException ... new row violates row-level security policy for table 'child_milestones' (42501)
-- Run this in the Supabase SQL editor against your project DB.
--
-- Assumes:
-- - public.children has primary key column children_id and parent_id referencing auth.users (id).
-- - public.child_milestones has child_id referencing the same id as children.children_id (same type recommended: uuid).

alter table if exists public.child_milestones enable row level security;

drop policy if exists "Parents read own child_milestones" on public.child_milestones;
drop policy if exists "Parents insert own child_milestones" on public.child_milestones;
drop policy if exists "Parents update own child_milestones" on public.child_milestones;
drop policy if exists "Parents delete own child_milestones" on public.child_milestones;

-- Shared predicate: row belongs to a child owned by the signed-in user.
create policy "Parents read own child_milestones"
on public.child_milestones
for select
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.children_id = child_milestones.child_id
      and c.parent_id = auth.uid()
  )
);

create policy "Parents insert own child_milestones"
on public.child_milestones
for insert
to authenticated
with check (
  exists (
    select 1
    from public.children c
    where c.children_id = child_milestones.child_id
      and c.parent_id = auth.uid()
  )
);

create policy "Parents update own child_milestones"
on public.child_milestones
for update
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.children_id = child_milestones.child_id
      and c.parent_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.children c
    where c.children_id = child_milestones.child_id
      and c.parent_id = auth.uid()
  )
);

create policy "Parents delete own child_milestones"
on public.child_milestones
for delete
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.children_id = child_milestones.child_id
      and c.parent_id = auth.uid()
  )
);

-- If your table uses child_id -> children.child_id (alternate column) instead of children_id, adjust the join, e.g.:
--   where c.child_id = child_milestones.child_id
