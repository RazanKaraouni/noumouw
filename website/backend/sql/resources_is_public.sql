-- Admin moderation: public resources appear in the mobile Learn section for all users.
-- Private resources (is_public = false) are visible only to that therapist's patients.

alter table public.resources
  add column if not exists is_public boolean not null default false;

create index if not exists resources_is_public_idx
  on public.resources (is_public)
  where is_public = true;
