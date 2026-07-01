-- Deprecated: use resources_unified_media.sql instead.
-- Run in Supabase SQL editor if `resources.content_type` still allows only article/video.
alter table public.resources drop constraint if exists resources_content_type_check;
alter table public.resources
  add constraint resources_content_type_check
  check (content_type in ('article', 'video', 'image', 'resource'));
