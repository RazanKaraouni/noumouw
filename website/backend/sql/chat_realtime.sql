-- Chat performance + security hardening for the updated schema (chat_room_id PK, message_id PK, parents table).
-- Safe to run multiple times where IF NOT EXISTS is used.

begin;

-- 1) Performance indexes
create index if not exists idx_chat_rooms_parent_created
  on public.chat_rooms (parent_id, created_at desc);

create index if not exists idx_chat_rooms_therapist_created
  on public.chat_rooms (therapist_id, created_at desc);

create unique index if not exists uq_chat_rooms_parent_therapist
  on public.chat_rooms (parent_id, therapist_id);

create index if not exists idx_messages_room_created
  on public.messages (room_id, created_at desc);

create index if not exists idx_messages_room_unread
  on public.messages (room_id, is_read, created_at desc);

create index if not exists idx_messages_sender_created
  on public.messages (sender_id, created_at desc);

-- 2) Room updated_at support for fast conversation sorting
alter table public.chat_rooms
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_chat_room_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.chat_rooms
  set updated_at = now()
  where chat_room_id = new.room_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_room_updated_at on public.messages;
create trigger trg_touch_chat_room_updated_at
after insert on public.messages
for each row execute function public.touch_chat_room_updated_at();

-- 3) Realtime publication
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.chat_rooms;

-- 4) Helpful view for latest message / unread aggregation
create or replace view public.chat_room_stats as
select
  r.chat_room_id as chat_room_id,
  max(m.created_at) as last_message_at,
  (
    select m2.content
    from public.messages m2
    where m2.room_id = r.chat_room_id
    order by m2.created_at desc
    limit 1
  ) as last_message_text,
  count(*) filter (where m.is_read = false) as unread_total
from public.chat_rooms r
left join public.messages m on m.room_id = r.chat_room_id
group by r.chat_room_id;

-- 5) Optional typing state table (architecture-ready)
create table if not exists public.chat_typing_state (
  room_id uuid not null references public.chat_rooms(chat_room_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_chat_typing_state_room_updated
  on public.chat_typing_state (room_id, updated_at desc);

alter publication supabase_realtime add table public.chat_typing_state;

-- 6) RLS (enabled but with safe checks against the updated schema)
alter table public.chat_rooms enable row level security;
alter table public.messages enable row level security;
alter table public.chat_typing_state enable row level security;

drop policy if exists "chat_rooms_select_participants" on public.chat_rooms;
create policy "chat_rooms_select_participants"
on public.chat_rooms
for select
to authenticated
using (
  auth.uid() = parent_id
  or exists (
    select 1
    from public.therapists t
    where t.therapist_id = chat_rooms.therapist_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "chat_rooms_insert_parent" on public.chat_rooms;
create policy "chat_rooms_insert_parent"
on public.chat_rooms
for insert
to authenticated
with check (auth.uid() = parent_id);

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (
  exists (
    select 1 from public.chat_rooms r
    where r.chat_room_id = messages.room_id
      and (
        r.parent_id = auth.uid()
        or exists (
          select 1
          from public.therapists t
          where t.therapist_id = r.therapist_id
            and t.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "messages_insert_participants" on public.messages;
create policy "messages_insert_participants"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.chat_rooms r
    where r.chat_room_id = messages.room_id
      and (
        r.parent_id = auth.uid()
        or exists (
          select 1
          from public.therapists t
          where t.therapist_id = r.therapist_id
            and t.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "messages_update_read_participants" on public.messages;
create policy "messages_update_read_participants"
on public.messages
for update
to authenticated
using (
  exists (
    select 1 from public.chat_rooms r
    where r.chat_room_id = messages.room_id
      and (
        r.parent_id = auth.uid()
        or exists (
          select 1
          from public.therapists t
          where t.therapist_id = r.therapist_id
            and t.user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1 from public.chat_rooms r
    where r.chat_room_id = messages.room_id
      and (
        r.parent_id = auth.uid()
        or exists (
          select 1
          from public.therapists t
          where t.therapist_id = r.therapist_id
            and t.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "typing_state_participants_rw" on public.chat_typing_state;
create policy "typing_state_participants_rw"
on public.chat_typing_state
for all
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.chat_rooms r
    where r.chat_room_id = chat_typing_state.room_id
      and (
        r.parent_id = auth.uid()
        or exists (
          select 1
          from public.therapists t
          where t.therapist_id = r.therapist_id
            and t.user_id = auth.uid()
        )
      )
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.chat_rooms r
    where r.chat_room_id = chat_typing_state.room_id
      and (
        r.parent_id = auth.uid()
        or exists (
          select 1
          from public.therapists t
          where t.therapist_id = r.therapist_id
            and t.user_id = auth.uid()
        )
      )
  )
);

commit;
