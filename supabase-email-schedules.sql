-- Email Schedules table for SAMA 2.0
-- Run this in your Supabase SQL Editor.
--
-- Backs the admin "Mejl → Schema" tab and the cron worker that triggers
-- weekly status / social-posts mailings. The /api/admin/email/schedules
-- route reads/updates by `kind` (the primary key) and never inserts new
-- rows, so the seed at the bottom of this file must run for the UI to
-- have anything to show.

CREATE TABLE IF NOT EXISTS email_schedules (
  kind              text        PRIMARY KEY,
  enabled           boolean     NOT NULL DEFAULT false,
  cron_day_of_week  text        CHECK (cron_day_of_week IS NULL OR cron_day_of_week IN ('mon','tue','wed','thu','fri','sat','sun')),
  cron_hour         integer     CHECK (cron_hour IS NULL OR (cron_hour BETWEEN 0 AND 23)),
  cron_minute       integer     NOT NULL DEFAULT 0 CHECK (cron_minute BETWEEN 0 AND 59),
  timezone          text        NOT NULL DEFAULT 'UTC',
  description       text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Admin-only table: the API uses the Supabase service-role client (see
-- lib/admin-guard.ts), which bypasses RLS. Enabling RLS with no policies
-- locks the table to service-role access.
ALTER TABLE email_schedules ENABLE ROW LEVEL SECURITY;

-- Seed the two kinds the admin UI knows about. ON CONFLICT keeps existing
-- rows untouched so re-running this file is safe.
INSERT INTO email_schedules (kind, enabled, cron_day_of_week, cron_hour, cron_minute, timezone, description)
VALUES
  ('weekly_status', false, 'mon', 8, 0, 'Europe/Stockholm', 'Veckostatus-mail till kunder'),
  ('social_posts',  false, 'mon', 9, 0, 'Europe/Stockholm', 'Sociala posts-förslag till kunder')
ON CONFLICT (kind) DO NOTHING;
