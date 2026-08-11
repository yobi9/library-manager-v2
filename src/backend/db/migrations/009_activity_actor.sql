-- =====================================================
-- 009 — Record the real actor of an activity
-- =====================================================
-- Adds `actor_user_id` to `activities` so admin-performed actions
-- (e.g. updating a user's avatar) keep the identity of WHO did them,
-- independently of the affected user (`user_id`). If that admin account
-- is later deleted, the FK sets the column to NULL (like `user_id`).
ALTER TABLE activities ADD COLUMN actor_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_actor_user_id ON activities(actor_user_id);
