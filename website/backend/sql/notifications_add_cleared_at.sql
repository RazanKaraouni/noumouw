-- Mark notifications as cleared (hidden in app) without deleting rows.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_uncleared
  ON notifications (user_id, created_at DESC)
  WHERE cleared_at IS NULL;
