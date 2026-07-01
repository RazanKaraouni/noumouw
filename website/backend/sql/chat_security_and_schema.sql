-- Chat schema and RLS hardening for parent/therapist messaging.
-- Uses the new schema: parents (replaces profiles), chat_rooms.chat_room_id, messages.message_id.

-- 1) Therapists must have therapists.user_id linked to auth.users so messages.sender_id stays valid.

-- 2) Enable RLS.
alter table if exists public.chat_rooms enable row level security;
alter table if exists public.messages enable row level security;

-- 3) Drop stale policies safely.
drop policy if exists "chat_rooms_select_participants" on public.chat_rooms;
drop policy if exists "chat_rooms_insert_therapist_or_parent" on public.chat_rooms;
drop policy if exists "messages_select_participants" on public.messages;
drop policy if exists "messages_insert_participants" on public.messages;
drop policy if exists "messages_update_recipient_read" on public.messages;

-- 4) chat_rooms policies.
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

create policy "chat_rooms_insert_therapist_or_parent"
on public.chat_rooms
for insert
to authenticated
with check (
  auth.uid() = parent_id
  or exists (
    select 1
    from public.therapists t
    where t.therapist_id = chat_rooms.therapist_id
      and t.user_id = auth.uid()
  )
);

-- 5) messages policies.
create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_rooms r
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

create policy "messages_insert_participants"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chat_rooms r
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

create policy "messages_update_recipient_read"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.chat_rooms r
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
  is_read = true
);
