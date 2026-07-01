-- Mirror of supabase/migrations/20260605110000_appointments_child_id_fk_rls.sql
-- appointments.child_id → children.children_id (integer PK)

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS child_id integer;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_child_id_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_child_id_fkey
  FOREIGN KEY (child_id)
  REFERENCES public.children (children_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_child_id_idx
  ON public.appointments (child_id);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_parent_select ON public.appointments;
DROP POLICY IF EXISTS appointments_parent_insert ON public.appointments;
DROP POLICY IF EXISTS appointments_parent_update ON public.appointments;
DROP POLICY IF EXISTS appointments_therapist_select ON public.appointments;

CREATE POLICY appointments_parent_select
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY appointments_parent_insert
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      child_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.children c
        WHERE c.children_id = appointments.child_id
          AND c.parent_id = auth.uid()
      )
    )
  );

CREATE POLICY appointments_parent_update
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY appointments_therapist_select
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.therapists t
      WHERE t.therapist_id = appointments.therapist_id
        AND t.user_id = auth.uid()
    )
  );
