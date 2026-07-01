-- Therapists no longer submit a password with join requests; admin approval generates one.
alter table public.therapist_join_requests
  alter column password_hash drop not null;
