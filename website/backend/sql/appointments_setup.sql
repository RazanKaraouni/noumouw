-- Run this once in Supabase SQL editor.
-- Schema reflects updated table/column names: parents, appointments(appointments_id),
-- therapists(therapist_id), availability(availability_id), children(children_id PK + child_id UUID).

-- PostgREST nested selects (e.g. availability -> therapists) require this FK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'availability_therapist_id_fkey'
      AND conrelid = 'public.availability'::regclass
  ) THEN
    ALTER TABLE public.availability
      ADD CONSTRAINT availability_therapist_id_fkey
      FOREIGN KEY (therapist_id) REFERENCES public.therapists (therapist_id) ON DELETE CASCADE;
  END IF;
END $$;

-- PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS; use a guarded block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parents_user_id_unique'
      AND conrelid = 'public.parents'::regclass
  ) THEN
    ALTER TABLE public.parents
      ADD CONSTRAINT parents_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE therapists
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE therapists
ADD COLUMN IF NOT EXISTS password TEXT;

ALTER TABLE therapists
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE therapists
ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;

ALTER TABLE therapists
DROP COLUMN IF EXISTS specialization;

ALTER TABLE therapists
DROP COLUMN IF EXISTS license_number;

ALTER TABLE therapists
DROP COLUMN IF EXISTS certificate_url;

CREATE TABLE IF NOT EXISTS therapist_private_notes (
  therapist_private_note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(therapist_id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(appointments_id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (therapist_id, appointment_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  appointment_id UUID REFERENCES appointments(appointments_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  cleared_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_availability_id UUID,
  p_therapist_id UUID,
  p_user_id UUID,
  p_appointment_date DATE,
  p_notes TEXT,
  p_child_id INTEGER DEFAULT NULL
)
RETURNS appointments
LANGUAGE plpgsql
AS $$
DECLARE
  v_slot availability%ROWTYPE;
  v_appointment appointments%ROWTYPE;
BEGIN
  SELECT * INTO v_slot
  FROM availability
  WHERE availability_id = p_availability_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;

  IF v_slot.is_booked THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;

  UPDATE availability
  SET is_booked = TRUE
  WHERE availability_id = p_availability_id;

  INSERT INTO appointments (
    therapist_id,
    user_id,
    availability_id,
    status,
    appointment_date,
    notes,
    child_id
  ) VALUES (
    p_therapist_id,
    p_user_id,
    p_availability_id,
    'pending',
    p_appointment_date,
    p_notes,
    p_child_id
  )
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_appointment_with_policy(
  p_appointment_id UUID,
  p_user_id UUID
)
RETURNS appointments
LANGUAGE plpgsql
AS $$
DECLARE
  v_app appointments%ROWTYPE;
  v_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT * INTO v_app
  FROM appointments
  WHERE appointments_id = p_appointment_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  SELECT start_time INTO v_start_time
  FROM availability
  WHERE availability_id = v_app.availability_id;

  IF v_start_time IS NULL THEN
    RAISE EXCEPTION 'Slot start time missing';
  END IF;

  IF (v_start_time - NOW()) < INTERVAL '2 hours' THEN
    RAISE EXCEPTION 'Cannot cancel within 2 hours';
  END IF;

  UPDATE appointments
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE appointments_id = p_appointment_id
  RETURNING * INTO v_app;

  UPDATE availability
  SET is_booked = FALSE
  WHERE availability_id = v_app.availability_id;

  RETURN v_app;
END;
$$;
