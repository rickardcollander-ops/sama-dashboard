-- TM portal "kundkort" upgrade: callback/meeting scheduling, a timestamped
-- call-activity log, and the worklist ("att ringa idag") queue.
--
-- Run this in your Supabase SQL editor AFTER supabase-apollo-duplicates.sql AND
-- supabase-call-status-timestamp.sql (this file rebuilds get_tm_campaign_leads
-- and keeps that file's call_status_updated_at column in the return shape).
-- It is idempotent (IF NOT EXISTS / DROP+CREATE) so it can be re-run safely.

-- 1a. Scheduling fields on the lead. Stored as timestamptz; the UI bridges them
--     to <input type="datetime-local"> (zon-naivt) on the client.
ALTER TABLE apollo_leads
  ADD COLUMN IF NOT EXISTS callback_at timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_at  timestamptz;

-- 1b. Append-only call log. One row per logged activity (note / status change /
--     scheduling). A table (not a jsonb column on apollo_leads) so concurrent
--     operators on the unauthenticated portal don't race a read-modify-write,
--     and so the worklist/stats can index it cheaply.
CREATE TABLE IF NOT EXISTS apollo_lead_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES apollo_leads(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES apollo_campaigns(id) ON DELETE CASCADE,
  -- note | status_change | callback_set | meeting_set | system
  kind        text NOT NULL DEFAULT 'note',
  body        text,                       -- free-text note (<= 4000 chars, enforced in API)
  status      text,                       -- snapshot of call_status when kind='status_change'
  operator    text,                       -- OPTIONAL free-text initials; portal has no identity
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apollo_lead_activities_lead
  ON apollo_lead_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apollo_lead_activities_campaign_created
  ON apollo_lead_activities(campaign_id, created_at DESC);

-- Locked down — service role only, exactly like apollo_leads/apollo_campaigns.
-- RLS enabled with NO policies => all access goes through /api/tm/* (service role).
ALTER TABLE apollo_lead_activities ENABLE ROW LEVEL SECURITY;

-- 1c. Worklist indexes. The "att ringa idag" queue runs three separate filtered
--     queries; these partial/btree indexes keep them fast as lead volume grows.
CREATE INDEX IF NOT EXISTS idx_apollo_leads_callback_at
  ON apollo_leads(callback_at) WHERE callback_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apollo_leads_meeting_at
  ON apollo_leads(meeting_at) WHERE meeting_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apollo_leads_call_status
  ON apollo_leads(call_status);

-- 1d. Updated RPC. The RETURNS TABLE shape changes (callback_at / meeting_at /
--     updated_at / activities added), and Postgres cannot CREATE OR REPLACE a
--     function whose return shape changes, so DROP first.
DROP FUNCTION IF EXISTS get_tm_campaign_leads(uuid);

CREATE FUNCTION get_tm_campaign_leads(p_campaign_id uuid)
RETURNS TABLE (
  id                 uuid,
  company_name       text,
  domain             text,
  contact_first_name text,
  contact_last_name  text,
  contact_title      text,
  contact_email      text,
  contact_phone      text,
  industry           text,
  company_size       text,
  city               text,
  country            text,
  linkedin_url       text,
  audit_score        int,
  audit_id           text,
  audited_at         timestamptz,
  call_status            text,
  call_notes             text,
  call_status_updated_at timestamptz,
  callback_at            timestamptz,
  meeting_at             timestamptz,
  updated_at             timestamptz,
  activities             jsonb,
  prior_campaigns        jsonb
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
    l.callback_at,
    l.meeting_at,
    l.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',         a.id,
            'kind',       a.kind,
            'body',       a.body,
            'status',     a.status,
            'operator',   a.operator,
            'created_at', a.created_at
          )
          ORDER BY a.created_at DESC
        )
        FROM apollo_lead_activities a
        WHERE a.lead_id = l.id
      ),
      '[]'::jsonb
    ) AS activities,
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

-- 1e. Portfolio-wide overview aggregates for the TM "Översikt" tab. One call
--     returns both the cross-campaign totals and a per-campaign breakdown so the
--     overview page doesn't have to pull every lead row down to the client.
CREATE OR REPLACE FUNCTION get_tm_overview()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'leads',             (SELECT count(*) FROM apollo_leads),
      'campaigns',         (SELECT count(*) FROM apollo_campaigns),
      'contacted',         (SELECT count(*) FROM apollo_leads WHERE call_status <> 'new'),
      'meetings_booked',   (SELECT count(*) FROM apollo_leads WHERE call_status = 'meeting_booked'),
      'converted',         (SELECT count(*) FROM apollo_leads WHERE call_status = 'converted'),
      'due_callbacks',     (SELECT count(*) FROM apollo_leads WHERE callback_at IS NOT NULL AND callback_at <= now()),
      'upcoming_meetings', (SELECT count(*) FROM apollo_leads WHERE meeting_at IS NOT NULL AND meeting_at >= now()),
      'by_status', COALESCE((
        SELECT jsonb_object_agg(call_status, c)
        FROM (SELECT call_status, count(*) AS c FROM apollo_leads GROUP BY call_status) s
      ), '{}'::jsonb)
    ),
    'campaigns', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'created_at') DESC)
      FROM (
        SELECT jsonb_build_object(
          'id',              c.id,
          'name',            c.name,
          'created_at',      c.created_at,
          'total',           count(l.id),
          'contacted',       count(l.id) FILTER (WHERE l.call_status <> 'new'),
          'meetings_booked', count(l.id) FILTER (WHERE l.call_status = 'meeting_booked'),
          'converted',       count(l.id) FILTER (WHERE l.call_status = 'converted'),
          'due_callbacks',   count(l.id) FILTER (WHERE l.callback_at IS NOT NULL AND l.callback_at <= now())
        ) AS row
        FROM apollo_campaigns c
        LEFT JOIN apollo_leads l ON l.campaign_id = c.id
        GROUP BY c.id, c.name, c.created_at
      ) sub
    ), '[]'::jsonb)
  );
$$;
