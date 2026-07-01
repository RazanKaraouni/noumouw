create table if not exists public.therapist_join_requests (
  request_id uuid primary key default gen_random_uuid(),
  full_name text not null,
  profession text not null,
  email text not null,
  phone text,
  address text not null,
  years_of_experience integer,
  bio text,
  profile_image_url text,
  password_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists therapist_join_requests_pending_email_idx
  on public.therapist_join_requests (lower(email))
  where status = 'pending';
