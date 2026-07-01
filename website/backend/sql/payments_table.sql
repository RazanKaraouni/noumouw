-- Same as supabase/migrations/20260617120000_payments_table.sql — run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments (appointments_id) ON DELETE CASCADE,
  child_id INTEGER REFERENCES public.children (children_id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES public.therapists (therapist_id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 25.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'waived')),
  payment_method TEXT,
  external_transaction_id TEXT,
  admin_notes TEXT,
  waived_by_admin_id UUID,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_appointment_id_unique
  ON public.payments (appointment_id);

CREATE INDEX IF NOT EXISTS payments_therapist_id_idx
  ON public.payments (therapist_id);

CREATE INDEX IF NOT EXISTS payments_parent_user_id_idx
  ON public.payments (parent_user_id);

CREATE INDEX IF NOT EXISTS payments_status_idx
  ON public.payments (status);
