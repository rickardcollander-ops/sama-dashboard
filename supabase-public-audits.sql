-- Public audits table for the free /audit landing page.
-- Run this in your Supabase SQL Editor.
--
-- Stores anonymous AI-readiness audit runs so they get a shareable URL
-- (/audit/r/{id}). Rows are inserted server-side using the service role
-- key, then read publicly via the anon key.

CREATE TABLE IF NOT EXISTS public_audits (
  id text PRIMARY KEY,                  -- short, URL-safe id (12 chars)
  domain text NOT NULL,
  payload jsonb NOT NULL,               -- full audit result JSON
  ip_hash text,                         -- sha256(ip + daily_salt) for soft rate limiting
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_audits_created_at
  ON public_audits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_audits_domain
  ON public_audits(domain);

-- Enable RLS
ALTER TABLE public_audits ENABLE ROW LEVEL SECURITY;

-- Anyone can read (the URL is the secret)
CREATE POLICY "Public audits are world-readable"
  ON public_audits FOR SELECT
  USING (true);

-- No public inserts/updates/deletes — only the service role can write
-- (server-side route inserts with SUPABASE_SERVICE_ROLE_KEY).
