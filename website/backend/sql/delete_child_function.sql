-- Parent-safe child deletion (run once in Supabase SQL editor).
-- Flutter calls: supabase.rpc('delete_child_and_related', { p_children_id, p_parent_id })
-- Requires service role or GRANT EXECUTE to authenticated.

CREATE OR REPLACE FUNCTION public.delete_child_and_related(
  p_children_id integer,
  p_parent_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_appt_ids uuid[];
BEGIN
  SELECT parent_id INTO v_owner
  FROM public.children
  WHERE children_id = p_children_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child not found';
  END IF;

  IF p_parent_id IS NOT NULL AND v_owner IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'Not allowed to delete this child';
  END IF;

  SELECT array_agg(appointments_id) INTO v_appt_ids
  FROM public.appointments
  WHERE child_id = p_children_id;

  DELETE FROM public.assignments WHERE child_id = p_children_id;
  DELETE FROM public.therapist_children WHERE child_id = p_children_id;
  DELETE FROM public.child_milestones WHERE child_id = p_children_id;
  DELETE FROM public.screening_results WHERE child_id = p_children_id;
  DELETE FROM public.reports WHERE child_id = p_children_id;
  DELETE FROM public.therapist_private_notes WHERE child_id = p_children_id;
  DELETE FROM public.messages WHERE child_id = p_children_id;

  IF v_appt_ids IS NOT NULL THEN
    DELETE FROM public.notifications WHERE appointment_id = ANY (v_appt_ids);
    DELETE FROM public.therapist_private_notes WHERE appointment_id = ANY (v_appt_ids);
    DELETE FROM public.payments WHERE appointment_id = ANY (v_appt_ids);
  END IF;

  DELETE FROM public.appointments WHERE child_id = p_children_id;
  DELETE FROM public.payments WHERE child_id = p_children_id;
  DELETE FROM public.children WHERE children_id = p_children_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_child_and_related(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_child_and_related(integer, uuid) TO service_role;
