-- Admin broadcast announcements (run once in Supabase SQL editor).
-- Aligns with announcementModel.js and public.admins (admin_id integer).

CREATE TABLE IF NOT EXISTS public.announcements (
  announcement_id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  target_audience text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (announcement_id),
  CONSTRAINT announcements_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(admin_id),
  CONSTRAINT announcements_target_audience_check CHECK (
    target_audience = ANY (
      ARRAY['all_users'::text, 'parents_only'::text, 'therapists_only'::text]
    )
  )
);

-- Upgrade legacy table (id, no sent_at, all/parents/therapists audiences).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE public.announcements RENAME COLUMN id TO announcement_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE public.announcements ADD COLUMN sent_at timestamptz;
    UPDATE public.announcements
    SET sent_at = COALESCE(created_at, now())
    WHERE sent_at IS NULL;
    ALTER TABLE public.announcements
      ALTER COLUMN sent_at SET DEFAULT now(),
      ALTER COLUMN sent_at SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'announcements_target_audience_check'
      AND conrelid = 'public.announcements'::regclass
  ) THEN
    ALTER TABLE public.announcements
      DROP CONSTRAINT announcements_target_audience_check;
  END IF;
END $$;

UPDATE public.announcements
SET target_audience = 'all_users'
WHERE target_audience = 'all';

UPDATE public.announcements
SET target_audience = 'parents_only'
WHERE target_audience = 'parents';

UPDATE public.announcements
SET target_audience = 'therapists_only'
WHERE target_audience = 'therapists';

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_target_audience_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_target_audience_check CHECK (
    target_audience = ANY (
      ARRAY['all_users'::text, 'parents_only'::text, 'therapists_only'::text]
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'announcements_admin_id_fkey'
      AND conrelid = 'public.announcements'::regclass
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES public.admins(admin_id);
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS announcements_sent_at_idx
  ON public.announcements (sent_at DESC);

CREATE INDEX IF NOT EXISTS announcements_admin_id_idx
  ON public.announcements (admin_id);
