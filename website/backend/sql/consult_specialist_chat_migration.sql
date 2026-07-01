-- Consult Specialist chat migration for Noumouw.
-- Aligns to the updated schema (children.children_id INTEGER PK, message_id PK, chat_room_id PK).

alter table if exists public.messages
  add column if not exists child_id integer references public.children(children_id) on delete set null;

alter table if exists public.messages
  add column if not exists report_links jsonb;

create index if not exists idx_messages_room_created_at
  on public.messages(room_id, created_at);

create index if not exists idx_messages_child_id
  on public.messages(child_id);

create index if not exists idx_messages_report_links_gin
  on public.messages using gin (report_links);

-- Keep one persistent room for each parent/therapist pair.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_rooms_parent_therapist_unique'
  ) then
    alter table public.chat_rooms
      add constraint chat_rooms_parent_therapist_unique unique (parent_id, therapist_id);
  end if;
end $$;

-- Helper to safely get/create a room in one call.
create or replace function public.get_or_create_chat_room(
  p_parent_id uuid,
  p_therapist_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_chat_room_id uuid;
begin
  insert into public.chat_rooms(parent_id, therapist_id)
  values (p_parent_id, p_therapist_id)
  on conflict (parent_id, therapist_id) do update
    set therapist_id = excluded.therapist_id
  returning chat_room_id into v_chat_room_id;

  return v_chat_room_id;
end;
$$;

grant execute on function public.get_or_create_chat_room(uuid, uuid) to authenticated;

-- Optional: report-type message filter helper for dashboards.
create or replace view public.chat_report_messages as
select
  m.message_id,
  m.room_id,
  m.sender_id,
  m.child_id,
  m.report_links,
  m.created_at
from public.messages m
where m.report_links is not null
  and jsonb_typeof(m.report_links) = 'array'
  and jsonb_array_length(m.report_links) > 0;
