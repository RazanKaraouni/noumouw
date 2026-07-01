-- Unified therapist resource: optional video + optional image on one row.
-- Keeps media_url for article document attachments (PDF, Word, etc.).
-- Run once in Supabase SQL editor.

-- 1) New optional media columns
alter table public.resources
  add column if not exists video_url text,
  add column if not exists image_url text;

-- 2) Move existing video/image rows out of media_url
update public.resources
set video_url = media_url
where content_type = 'video'
  and media_url is not null
  and trim(media_url) <> ''
  and video_url is null;

update public.resources
set image_url = media_url
where content_type = 'image'
  and media_url is not null
  and trim(media_url) <> ''
  and image_url is null;

-- 3) Legacy articles that stored video/image in media_url
update public.resources
set video_url = media_url,
    media_url = null
where content_type = 'article'
  and media_url is not null
  and trim(media_url) <> ''
  and video_url is null
  and media_url ~* '\.(mp4|mov)(\?|$)';

update public.resources
set image_url = media_url,
    media_url = null
where content_type = 'article'
  and media_url is not null
  and trim(media_url) <> ''
  and image_url is null
  and media_url ~* '\.(jpg|jpeg|png|webp|gif)(\?|$)';

-- 4) Pure video/image rows no longer need media_url
update public.resources
set media_url = null
where content_type in ('video', 'image')
  and (
    (content_type = 'video' and video_url is not null)
    or (content_type = 'image' and image_url is not null)
  );

-- 5) Allow unified "resource" content type
alter table public.resources
  drop constraint if exists resources_content_type_check;

alter table public.resources
  add constraint resources_content_type_check
  check (content_type in ('article', 'video', 'image', 'resource'));

-- 6) Normalize old video/image rows to the unified type (optional but recommended)
update public.resources
set content_type = 'resource'
where content_type in ('video', 'image');

notify pgrst, 'reload schema';
