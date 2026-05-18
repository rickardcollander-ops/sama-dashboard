-- google_tokens: stores OAuth tokens for Google API integrations per site.
-- One row per (site_id, service) combination.
-- All services (search_console, analytics, ads) share the same Google account
-- credentials — they are written together when the user completes OAuth.
CREATE TABLE IF NOT EXISTS google_tokens (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       uuid        NOT NULL REFERENCES user_sites(id) ON DELETE CASCADE,
  service       text        NOT NULL CHECK (service IN ('search_console', 'analytics', 'ads')),
  access_token  text,
  refresh_token text,
  token_expiry  timestamptz,
  account_email text,
  connected_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, service)
);

CREATE INDEX IF NOT EXISTS google_tokens_site_id_idx ON google_tokens(site_id);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own Google tokens"
  ON google_tokens
  USING (
    EXISTS (
      SELECT 1 FROM user_sites
      WHERE user_sites.id = google_tokens.site_id
        AND user_sites.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_sites
      WHERE user_sites.id = google_tokens.site_id
        AND user_sites.user_id = auth.uid()
    )
  );
