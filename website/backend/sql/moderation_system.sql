-- User reporting and account suspension (run once in Supabase SQL editor).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_status') THEN
    CREATE TYPE public.moderation_status AS ENUM (
      'pending',
      'dismissed',
      'content_removed',
      'user_suspended'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.resource_reports (
  report_id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type = ANY (ARRAY['resource'::text, 'post'::text, 'comment'::text])),
  resource_id uuid REFERENCES public.resources(resources_id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(post_id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(comment_id) ON DELETE CASCADE,
  reason text NOT NULL,
  status public.moderation_status DEFAULT 'pending'::public.moderation_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT resource_reports_pkey PRIMARY KEY (report_id)
);

CREATE INDEX IF NOT EXISTS resource_reports_status_idx ON public.resource_reports (status);
CREATE INDEX IF NOT EXISTS resource_reports_reporter_idx ON public.resource_reports (reporter_id);

CREATE TABLE IF NOT EXISTS public.email_blocklist (
  block_id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL,
  banned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_blocklist_pkey PRIMARY KEY (block_id)
);

CREATE INDEX IF NOT EXISTS email_blocklist_email_idx ON public.email_blocklist (lower(email));
