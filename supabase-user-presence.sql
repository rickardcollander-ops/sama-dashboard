-- user_presence: one row per user, refreshed by a client heartbeat while
-- the dashboard is open. Used by the admin page to render an online/offline
-- indicator next to each account.
CREATE TABLE IF NOT EXISTS user_presence (
  user_id      uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_presence_last_seen_idx ON user_presence(last_seen_at DESC);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Each user can read and upsert their own presence row. The admin endpoint
-- uses the service-role client and bypasses RLS to read every row.
CREATE POLICY "Users read own presence"
  ON user_presence
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own presence"
  ON user_presence
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own presence"
  ON user_presence
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
