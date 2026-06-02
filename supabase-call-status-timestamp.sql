-- Track when call_status was last changed so the TM portal can show the
-- operator how stale each lead's status is.
--
-- Run this AFTER supabase-apollo-campaigns.sql and supabase-apollo-duplicates.sql.

ALTER TABLE apollo_leads
  ADD COLUMN IF NOT EXISTS call_status_updated_at timestamptz;

-- Backfill so existing rows show a reasonable timestamp instead of NULL.
UPDATE apollo_leads
  SET call_status_updated_at = COALESCE(updated_at, created_at)
  WHERE call_status_updated_at IS NULL;

-- Replace the TM lead RPC so it returns the new column.
CREATE OR REPLACE FUNCTION get_tm_campaign_leads(p_campaign_id uuid)
RETURNS TABLE (
  id                      uuid,
  company_name            text,
  domain                  text,
  contact_first_name      text,
  contact_last_name       text,
  contact_title           text,
  contact_email           text,
  contact_phone           text,
  industry                text,
  company_size            text,
  city                    text,
  country                 text,
  linkedin_url            text,
  audit_score             int,
  audit_id                text,
  audited_at              timestamptz,
  call_status             text,
  call_notes              text,
  call_status_updated_at  timestamptz,
  prior_campaigns         jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    l.id,
    l.company_name,
    l.domain,
    l.contact_first_name,
    l.contact_last_name,
    l.contact_title,
    l.contact_email,
    l.contact_phone,
    l.industry,
    l.company_size,
    l.city,
    l.country,
    l.linkedin_url,
    l.audit_score,
    l.audit_id,
    l.audited_at,
    l.call_status,
    l.call_notes,
    l.call_status_updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'campaign_id',   c.id,
            'campaign_name', c.name,
            'call_status',   o.call_status
          )
          ORDER BY c.created_at
        )
        FROM apollo_leads o
        JOIN apollo_campaigns c ON c.id = o.campaign_id
        WHERE o.domain IS NOT NULL
          AND o.domain = l.domain
          AND o.campaign_id <> p_campaign_id
      ),
      '[]'::jsonb
    ) AS prior_campaigns
  FROM apollo_leads l
  WHERE l.campaign_id = p_campaign_id
  ORDER BY l.company_name;
$$;
