-- Apollo telemarketing campaigns: import a CSV from Apollo, run a site-audit
-- per company, and surface a per-lead "download PDF report" button in the
-- admin view (/c/admin/campaigns).
--
-- Run this in your Supabase SQL Editor after supabase-public-audits.sql
-- (apollo_leads.audit_id references public_audits.id).

CREATE TABLE IF NOT EXISTS apollo_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_filename text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_leads int NOT NULL DEFAULT 0,
  audited_leads int NOT NULL DEFAULT 0,
  failed_leads int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apollo_campaigns_created_at
  ON apollo_campaigns(created_at DESC);

CREATE TABLE IF NOT EXISTS apollo_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES apollo_campaigns(id) ON DELETE CASCADE,
  -- Core company fields (always populated when present in CSV).
  company_name text NOT NULL,
  domain text,                              -- normalized lowercase host
  -- Contact (Apollo CSV usually contains the primary contact for the row).
  contact_first_name text,
  contact_last_name text,
  contact_title text,
  contact_email text,
  contact_phone text,
  -- Misc Apollo metadata we want to show in the call sheet.
  industry text,
  company_size text,
  city text,
  country text,
  linkedin_url text,
  -- Original row preserved verbatim so future migrations can re-extract.
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Audit tracking. audit_id points at public_audits when an audit completes,
  -- so the PDF route can render the same report shape that /audit/r/{id} uses.
  audit_id text REFERENCES public_audits(id) ON DELETE SET NULL,
  audit_status text NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed | skipped
  audit_error text,
  audit_score int,                          -- cached overall score for list table
  audited_at timestamptz,
  -- Outreach status used in the call sheet.
  call_status text NOT NULL DEFAULT 'new', -- new | called | callback | not_interested | meeting_booked | converted
  call_notes text,
  pdf_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apollo_leads_campaign
  ON apollo_leads(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apollo_leads_audit_status
  ON apollo_leads(audit_status);
CREATE INDEX IF NOT EXISTS idx_apollo_leads_domain
  ON apollo_leads(domain);
-- Same domain can legitimately appear in multiple campaigns, but inside one
-- campaign we de-dup on domain so re-uploads don't double-bill audits.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_apollo_leads_campaign_domain
  ON apollo_leads(campaign_id, domain)
  WHERE domain IS NOT NULL;

-- Locked down — service role only. Admin API routes use the service role.
ALTER TABLE apollo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE apollo_leads ENABLE ROW LEVEL SECURITY;

-- updated_at auto-bump
CREATE OR REPLACE FUNCTION apollo_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apollo_campaigns_touch ON apollo_campaigns;
CREATE TRIGGER trg_apollo_campaigns_touch
  BEFORE UPDATE ON apollo_campaigns
  FOR EACH ROW EXECUTE FUNCTION apollo_touch_updated_at();

DROP TRIGGER IF EXISTS trg_apollo_leads_touch ON apollo_leads;
CREATE TRIGGER trg_apollo_leads_touch
  BEFORE UPDATE ON apollo_leads
  FOR EACH ROW EXECUTE FUNCTION apollo_touch_updated_at();
