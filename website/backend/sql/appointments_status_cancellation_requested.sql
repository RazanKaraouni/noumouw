-- Parent cancellation workflow: status becomes 'cancellation_requested' until the
-- therapist approves (then 'cancelled'). Run once in Supabase SQL editor.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'confirmed'::text,
        'cancelled'::text,
        'completed'::text,
        'cancellation_requested'::text
      ]
    )
  );

-- Fix legacy rows that used uppercase or other invalid casing
UPDATE public.appointments
SET status = lower(trim(status))
WHERE status IS NOT NULL
  AND status <> lower(trim(status));
