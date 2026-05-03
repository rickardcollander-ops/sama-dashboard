-- User Settings table for SAMA 2.0
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own settings
CREATE POLICY "Users can read own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Notes on the settings JSON shape used by CMS publishing:
--
--   settings.publishing_destinations: [
--     {
--       id: "dest_xxx",
--       kind: "wordpress" | "webflow" | "ghost" | "notion" | "webhook",
--       name: "Main blog",
--       config: { ...kind-specific credentials/fields... },
--       created_at: ISO
--     }
--   ]
--
--   settings.scheduled_publishes: [
--     {
--       id: "sched_xxx",
--       piece_id: string,
--       destination_id: "dest_xxx",
--       scheduled_at: ISO,
--       status: "scheduled" | "publishing" | "published" | "failed",
--       published_url?: string,
--       error?: string,
--       payload: { title, slug, body_markdown, excerpt, tags, language, ... }
--     }
--   ]
--
-- The /api/integrations/cron route processes due scheduled_publishes every
-- 5 minutes (Vercel cron). It requires CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY
-- env vars to bypass RLS during the sweep.
