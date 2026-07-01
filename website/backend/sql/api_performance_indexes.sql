-- Performance indexes for sub-2s API responses under normal load.
-- Apply via: node scripts/applySqlMigration.js sql/api_performance_indexes.sql

-- Parenting tips: approved list + daily tip
CREATE INDEX IF NOT EXISTS idx_parenting_tips_status_approved_at
  ON parenting_tips (status, approved_at DESC)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_parenting_tips_status_created_at
  ON parenting_tips (status, created_at DESC);

-- Nearby providers: bounding-box filters on coordinates
CREATE INDEX IF NOT EXISTS idx_therapists_lat_lng
  ON therapists (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinics_active_lat_lng
  ON clinics (latitude, longitude)
  WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Appointments: admin overview + therapist dashboards
CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON appointments (status);

CREATE INDEX IF NOT EXISTS idx_appointments_therapist_status
  ON appointments (therapist_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_started_status
  ON appointments (is_started, status)
  WHERE is_started = true;

-- Resource engagement aggregates
CREATE INDEX IF NOT EXISTS idx_resource_likes_resources_id
  ON resource_likes (resources_id);

CREATE INDEX IF NOT EXISTS idx_resource_saves_resources_id
  ON resource_saves (resources_id);

-- Parent registration trends
CREATE INDEX IF NOT EXISTS idx_parents_created_at
  ON parents (created_at);
