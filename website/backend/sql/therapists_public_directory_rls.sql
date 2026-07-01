-- Allow authenticated users to read the public therapist directory fields.
alter table if exists public.therapists enable row level security;

drop policy if exists "Authenticated users can read therapists directory"
on public.therapists;

create policy "Authenticated users can read therapists directory"
on public.therapists
for select
to authenticated
using (true);

grant select (
  therapist_id,
  user_id,
  full_name,
  email,
  profession,
  address,
  bio,
  phone,
  years_of_experience,
  profile_image_url,
  created_at
)
on table public.therapists
to authenticated;
