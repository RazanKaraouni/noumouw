-- Therapist dashboard: assignment fields, caseload gate, private notes by child, RLS helpers
-- Run in Supabase SQL editor. Safe to re-run where guarded by IF NOT EXISTS / IF EXISTS.

-- -----------------------------------------------------------------------------
-- 1) assignments: due_date + priority
-- -----------------------------------------------------------------------------
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS due_date date;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS priority text
    DEFAULT 'medium';

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_priority_check;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_priority_check
  CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high'));

-- -----------------------------------------------------------------------------
-- 2) therapist_private_notes: tie notes to child (optional appointment)
-- -----------------------------------------------------------------------------
ALTER TABLE public.therapist_private_notes
  ADD COLUMN IF NOT EXISTS child_id integer REFERENCES public.children (children_id) ON DELETE CASCADE;

ALTER TABLE public.therapist_private_notes
  ALTER COLUMN appointment_id DROP NOT NULL;

-- Allow multiple notes per therapist (drop one-row-per-appointment rule).
ALTER TABLE public.therapist_private_notes DROP CONSTRAINT IF EXISTS therapist_private_notes_therapist_id_appointment_id_key;

CREATE INDEX IF NOT EXISTS therapist_private_notes_therapist_child_idx
  ON public.therapist_private_notes (therapist_id, child_id);

-- -----------------------------------------------------------------------------
-- 3) Caseload gate: completed appointment OR therapist_children link
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.therapist_has_child_in_caseload (
  p_therapist_id uuid,
  p_child_id integer
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.therapist_children tc
    WHERE tc.therapist_id = p_therapist_id
      AND tc.child_id = p_child_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.therapist_id = p_therapist_id
      AND a.child_id = p_child_id
      AND lower(coalesce(a.status::text, '')) = 'completed'
  );
$$;

-- Keep legacy name used by older migrations — delegate to new logic.
CREATE OR REPLACE FUNCTION public.therapist_has_child_appointment (
  p_therapist_id uuid,
  p_child_id integer
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.therapist_has_child_in_caseload(p_therapist_id, p_child_id);
$$;

-- -----------------------------------------------------------------------------
-- 4) assignments RLS: full therapist CRUD + parent rules unchanged
-- -----------------------------------------------------------------------------
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignments_therapist_select ON public.assignments;
DROP POLICY IF EXISTS assignments_therapist_insert ON public.assignments;
DROP POLICY IF EXISTS assignments_therapist_update ON public.assignments;
DROP POLICY IF EXISTS assignments_therapist_delete ON public.assignments;

CREATE POLICY assignments_therapist_select
ON public.assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.therapist_id = assignments.therapist_id
      AND t.user_id = auth.uid()
      AND public.therapist_has_child_in_caseload(t.therapist_id, assignments.child_id)
  )
);

CREATE POLICY assignments_therapist_insert
ON public.assignments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.therapist_id = assignments.therapist_id
      AND t.user_id = auth.uid()
      AND public.therapist_has_child_in_caseload(t.therapist_id, assignments.child_id)
  )
);

CREATE POLICY assignments_therapist_update
ON public.assignments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.therapist_id = assignments.therapist_id
      AND t.user_id = auth.uid()
      AND public.therapist_has_child_in_caseload(t.therapist_id, assignments.child_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.therapist_id = assignments.therapist_id
      AND t.user_id = auth.uid()
      AND public.therapist_has_child_in_caseload(t.therapist_id, assignments.child_id)
  )
);

CREATE POLICY assignments_therapist_delete
ON public.assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.therapist_id = assignments.therapist_id
      AND t.user_id = auth.uid()
      AND public.therapist_has_child_in_caseload(t.therapist_id, assignments.child_id)
  )
);

-- Parent policies (recreate — same predicates as activity_library_assignments.sql)
DROP POLICY IF EXISTS assignments_parent_select ON public.assignments;
DROP POLICY IF EXISTS assignments_parent_update ON public.assignments;

CREATE POLICY assignments_parent_select
ON public.assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.children c
    WHERE c.children_id = assignments.child_id
      AND c.parent_id = auth.uid()
  )
);

CREATE POLICY assignments_parent_update
ON public.assignments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.children c
    WHERE c.children_id = assignments.child_id
      AND c.parent_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.children c
    WHERE c.children_id = assignments.child_id
      AND c.parent_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- 5) UPDATE trigger: parents vs therapists field permissions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assignments_enforce_note_permissions ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_parent boolean := EXISTS (
    SELECT 1
    FROM public.children c
    WHERE c.children_id = new.child_id
      AND c.parent_id = auth.uid()
  );
  v_is_therapist boolean := EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.therapist_id = new.therapist_id
      AND t.user_id = auth.uid()
  );
BEGIN
  IF tg_op <> 'UPDATE' THEN
    RETURN new;
  END IF;

  IF v_is_parent AND NOT v_is_therapist THEN
    IF new.assignment_id IS DISTINCT FROM old.assignment_id
       OR new.child_id IS DISTINCT FROM old.child_id
       OR new.therapist_id IS DISTINCT FROM old.therapist_id
       OR new.title IS DISTINCT FROM old.title
       OR new.description IS DISTINCT FROM old.description
       OR new.domain IS DISTINCT FROM old.domain
       OR new.due_date IS DISTINCT FROM old.due_date
       OR new.priority IS DISTINCT FROM old.priority
       OR new.therapist_reply IS DISTINCT FROM old.therapist_reply
       OR new.created_at IS DISTINCT FROM old.created_at
    THEN
      RAISE EXCEPTION 'Parents may only update status and parent_notes';
    END IF;
  ELSIF v_is_therapist AND NOT v_is_parent THEN
    IF new.parent_notes IS DISTINCT FROM old.parent_notes
    THEN
      RAISE EXCEPTION 'Therapists may not edit parent_notes';
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_enforce_note_permissions ON public.assignments;

CREATE TRIGGER trg_assignments_enforce_note_permissions
BEFORE UPDATE ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.assignments_enforce_note_permissions ();

-- -----------------------------------------------------------------------------
-- 6) therapist_children RLS (for direct Supabase access)
-- -----------------------------------------------------------------------------
ALTER TABLE public.therapist_children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists can view own children" ON public.therapist_children;
CREATE POLICY "Therapists can view own children"
ON public.therapist_children
FOR SELECT
USING (
  therapist_id IN (
    SELECT t.therapist_id
    FROM public.therapists t
    WHERE t.user_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- 7) therapist_private_notes: therapist-only access
-- -----------------------------------------------------------------------------
ALTER TABLE public.therapist_private_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS therapist_private_notes_therapist_all ON public.therapist_private_notes;

CREATE POLICY therapist_private_notes_therapist_all
ON public.therapist_private_notes
FOR ALL
TO authenticated
USING (
  therapist_id IN (
    SELECT t.therapist_id
    FROM public.therapists t
    WHERE t.user_id = auth.uid()
  )
)
WITH CHECK (
  therapist_id IN (
    SELECT t.therapist_id
    FROM public.therapists t
    WHERE t.user_id = auth.uid()
  )
);

-- Therapists read milestones for linked children
DROP POLICY IF EXISTS child_milestones_therapist_select ON public.child_milestones;
CREATE POLICY child_milestones_therapist_select
ON public.child_milestones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.therapist_children tc
    JOIN public.therapists t ON t.therapist_id = tc.therapist_id
    WHERE t.user_id = auth.uid()
      AND tc.child_id = child_milestones.child_id
  )
);

DROP POLICY IF EXISTS screening_results_therapist_select ON public.screening_results;
CREATE POLICY screening_results_therapist_select
ON public.screening_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.therapist_children tc
    JOIN public.therapists t ON t.therapist_id = tc.therapist_id
    WHERE t.user_id = auth.uid()
      AND tc.child_id = screening_results.child_id
  )
);
