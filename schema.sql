-- Cloudflare D1 schema matching the demo's mock tables (localStorage keys suni-demo-v11:<table>).
-- Apply with: wrangler d1 execute suni-safeguarding --file=schema.sql

CREATE TABLE IF NOT EXISTS volunteers (
  id           TEXT PRIMARY KEY,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at   TEXT NOT NULL,            -- ISO 8601
  archived_at  TEXT,                     -- NULL while active
  profile      TEXT NOT NULL DEFAULT '{}' -- JSON: type, phone, org, roles, event_ids, notes, access_ni
);
CREATE INDEX IF NOT EXISTS idx_vol_status ON volunteers(status, last_name);

CREATE TABLE IF NOT EXISTS training_records (
  id            TEXT PRIMARY KEY,        -- certificate id
  volunteer_id  TEXT NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  module_name   TEXT NOT NULL,
  completed_at  TEXT NOT NULL,
  details       TEXT NOT NULL DEFAULT '{}' -- JSON: pathway_id, version, expires_at, score, attestation, revoked…
);
CREATE INDEX IF NOT EXISTS idx_rec_vol ON training_records(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_rec_completed ON training_records(completed_at);

-- Append-only. The app never UPDATEs this table; rows are only removed by
-- volunteer deletion (erasure) or the 5-year retention job.
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  volunteer_id  TEXT,                    -- NULL for system/admin-only events
  actor         TEXT NOT NULL,           -- learner | admin | system
  action        TEXT NOT NULL,
  details       TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_vol ON audit_logs(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

CREATE TABLE IF NOT EXISTS magic_links (
  token         TEXT PRIMARY KEY,        -- store a SHA-256 hash in production
  volunteer_id  TEXT NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,           -- created + 30 minutes
  used_at       TEXT
);

-- Daily retention job (Cron Trigger), mirrors runCleanup() in src/admin.js:
--   DELETE FROM volunteers       WHERE status='archived' AND archived_at < datetime('now','-5 years');
--   DELETE FROM training_records WHERE completed_at < datetime('now','-5 years');
--   DELETE FROM audit_logs       WHERE created_at   < datetime('now','-5 years');
--   INSERT INTO audit_logs (...) VALUES (..., 'system', 'retention_cleanup', '{counts only}');
