-- Private bucket for child profile photos (signed URLs; see API + mobile client).
-- Manual: Supabase Dashboard → Storage → child-profiles → ensure Public bucket is OFF.

insert into storage.buckets (id, name, public)
values ('child-profiles', 'child-profiles', false)
on conflict (id) do update set public = excluded.public;

-- Parents may upload/update/delete only under their own folder.
drop policy if exists "Parents upload own child profile photos" on storage.objects;
create policy "Parents upload own child profile photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'child-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Parents update own child profile photos" on storage.objects;
create policy "Parents update own child profile photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'child-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'child-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Parents delete own child profile photos" on storage.objects;
create policy "Parents delete own child profile photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'child-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Profile photos require signed URLs (private bucket).
drop policy if exists "Public read child profile photos" on storage.objects;
drop policy if exists "Parents read own child profile photos" on storage.objects;
create policy "Parents read own child profile photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'child-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);
