-- Run once on existing databases that created therapist_join_requests before password_hash was nullable.
alter table public.therapist_join_requests
  alter column password_hash drop not null;
