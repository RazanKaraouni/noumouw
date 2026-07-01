-- Allow RESOURCE_LIKE notification type (run after therapist_notifications.sql).
ALTER TABLE public.therapist_notifications
  DROP CONSTRAINT IF EXISTS therapist_notifications_type_check;

ALTER TABLE public.therapist_notifications
  ADD CONSTRAINT therapist_notifications_type_check
  CHECK (
    type IN (
      'APPOINTMENT_REQUEST',
      'ASSIGNMENT_DONE',
      'ASSIGNMENT_NOTE',
      'NEW_MESSAGE',
      'RESOURCE_LIKE'
    )
  );
