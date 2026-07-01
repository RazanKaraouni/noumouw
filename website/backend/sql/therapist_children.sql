-- Links children to therapists when an appointment is confirmed (or again on session complete; idempotent).
-- Run in Supabase SQL editor if this table is not present yet.

CREATE TABLE IF NOT EXISTS public.therapist_children (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL,
  child_id integer NOT NULL,
  parent_id uuid NOT NULL,
  appointment_id uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT therapist_children_pkey PRIMARY KEY (id),
  CONSTRAINT therapist_children_therapist_id_fkey
    FOREIGN KEY (therapist_id) REFERENCES public.therapists (therapist_id) ON DELETE CASCADE,
  CONSTRAINT therapist_children_child_id_fkey
    FOREIGN KEY (child_id) REFERENCES public.children (children_id) ON DELETE CASCADE,
  CONSTRAINT therapist_children_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.parents (parent_id) ON DELETE CASCADE,
  CONSTRAINT therapist_children_appointment_id_fkey
    FOREIGN KEY (appointment_id) REFERENCES public.appointments (appointments_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS therapist_children_therapist_child_uidx
  ON public.therapist_children (therapist_id, child_id);

CREATE INDEX IF NOT EXISTS therapist_children_therapist_id_idx
  ON public.therapist_children (therapist_id);
