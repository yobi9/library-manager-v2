-- Persists login-failure counters so lockouts survive server restarts and are
-- shared across multiple processes (replaces the in-memory Map that lived in
-- auth-service). `locked_at` stores a millisecond epoch timestamp.
CREATE TABLE IF NOT EXISTS login_attempts (
  username TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_at INTEGER NOT NULL DEFAULT 0,
  last_failed_at INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_at ON login_attempts(locked_at);
