-- Audit leads (email captures) for the public AI-readiness audit.
-- Run this in your Supabase SQL Editor after supabase-public-audits.sql.

CREATE TABLE IF NOT EXISTS audit_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  domain text NOT NULL,
  audit_id text REFERENCES public_audits(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'audit_landing',
  consent_marketing boolean NOT NULL DEFAULT true,
  user_agent text,
  ip_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_leads_email ON audit_leads(email);
CREATE INDEX IF NOT EXISTS idx_audit_leads_created_at ON audit_leads(created_at DESC);
-- Prevent obvious dup spam: same email + audit can only be saved once.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_audit_leads_email_audit
  ON audit_leads(email, audit_id);

-- Locked down — service role only (writes from server) — no public access.
ALTER TABLE audit_leads ENABLE ROW LEVEL SECURITY;
