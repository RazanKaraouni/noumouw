-- Allow deleting a child to cascade into all dependent rows.
-- Run this once in the Supabase SQL editor, then run delete_child_function.sql
-- so the parent app can call delete_child_and_related via RPC.
--
-- Without this, deleting from public.children fails with a foreign key
-- violation whenever the child has any related milestones, screening
-- results, appointments, payments, or reports. The Flutter app then
-- shows the generic "Unable to remove child." snackbar.

-- child_milestones.child_id -> children.children_id
ALTER TABLE public.child_milestones
  DROP CONSTRAINT IF EXISTS child_milestones_child_id_fkey;
ALTER TABLE public.child_milestones
  ADD CONSTRAINT child_milestones_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE CASCADE;

-- screening_results.child_id -> children.children_id
ALTER TABLE public.screening_results
  DROP CONSTRAINT IF EXISTS screening_results_child_id_fkey;
ALTER TABLE public.screening_results
  ADD CONSTRAINT screening_results_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE CASCADE;

-- appointments.child_id -> children.children_id
-- (therapist_private_notes and payments reference appointments, so we
--  cascade those too so an appointment deletion does not get blocked.)
ALTER TABLE public.therapist_private_notes
  DROP CONSTRAINT IF EXISTS therapist_private_notes_appointment_id_fkey;
ALTER TABLE public.therapist_private_notes
  ADD CONSTRAINT therapist_private_notes_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(appointments_id)
  ON DELETE CASCADE;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_appointment_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(appointments_id)
  ON DELETE CASCADE;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_child_id_fkey;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE SET NULL;

-- payments.child_id -> children.children_id
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_child_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE CASCADE;

-- reports.child_id -> children.children_id
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_child_id_fkey;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE CASCADE;

-- therapist_children.child_id -> children.children_id
ALTER TABLE public.therapist_children
  DROP CONSTRAINT IF EXISTS therapist_children_child_id_fkey;
ALTER TABLE public.therapist_children
  ADD CONSTRAINT therapist_children_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE CASCADE;

-- assignments.child_id -> children.children_id
ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_child_id_fkey;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE CASCADE;

-- therapist_private_notes.child_id -> children.children_id
ALTER TABLE public.therapist_private_notes
  DROP CONSTRAINT IF EXISTS therapist_private_notes_child_id_fkey;
ALTER TABLE public.therapist_private_notes
  ADD CONSTRAINT therapist_private_notes_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE CASCADE;

-- messages.child_id -> children.children_id (remove chat context for deleted child)
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_child_id_fkey;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children(children_id)
  ON DELETE CASCADE;
