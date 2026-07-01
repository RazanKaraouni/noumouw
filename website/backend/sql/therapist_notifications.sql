-- Therapist in-app notifications (run in Supabase SQL editor).
CREATE TABLE IF NOT EXISTS therapist_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES therapists(therapist_id) ON DELETE CASCADE,
  sender_id UUID,
  type TEXT NOT NULL CHECK (
    type IN (
      'APPOINTMENT_REQUEST',
      'ASSIGNMENT_DONE',
      'ASSIGNMENT_NOTE',
      'NEW_MESSAGE',
      'RESOURCE_LIKE'
    )
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapist_notifications_recipient_created
  ON therapist_notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_therapist_notifications_recipient_unread
  ON therapist_notifications (recipient_id)
  WHERE is_read = FALSE;
