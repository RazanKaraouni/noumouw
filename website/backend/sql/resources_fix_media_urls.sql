-- Fix relative storage paths in resources.media_url (e.g. resources/ASHA_....pdf).
-- Run once in the Supabase SQL editor.
--
-- Your PDFs live in the public "resources" bucket. The app and backend need the
-- full public URL, not a relative path.
--
-- Before: resources/ASHA_Birthto3months_EN.pdf
-- After:  https://pgruslpzejtupbyvqyba.supabase.co/storage/v1/object/public/resources/ASHA_Birthto3months_EN.pdf

-- Preview rows that will be updated (optional — run first to verify).
-- select resources_id, title, media_url
-- from public.resources
-- where media_url is not null
--   and trim(media_url) <> ''
--   and media_url not like 'http%';

update public.resources
set media_url =
  'https://pgruslpzejtupbyvqyba.supabase.co/storage/v1/object/public/' || trim(media_url)
where media_url is not null
  and trim(media_url) <> ''
  and media_url not like 'http%';

-- Verify after update.
-- select resources_id, title, media_url, body_text
-- from public.resources
-- where content_type = 'article'
-- order by title;

notify pgrst, 'reload schema';
