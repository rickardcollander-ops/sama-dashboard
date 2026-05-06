-- user_sites: one row per site per user.
-- The first site always uses id = user.id to preserve existing backend tenant data.
CREATE TABLE IF NOT EXISTS user_sites (
  id        uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_name text        NOT NULL DEFAULT '',
  settings  jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sites_user_id_idx ON user_sites(user_id);

ALTER TABLE user_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sites"
  ON user_sites
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow service-role (admin) to read all rows (bypasses RLS automatically).

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_sites_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_sites_updated_at
  BEFORE UPDATE ON user_sites
  FOR EACH ROW EXECUTE FUNCTION update_user_sites_updated_at();
