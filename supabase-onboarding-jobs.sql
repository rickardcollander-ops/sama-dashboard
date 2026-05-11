-- onboarding_jobs: tracks the long-running "analyze site + build 30-day plan
-- + write 2 drafts" job that runs after a user finishes the 5-step
-- onboarding wizard. The wizard kicks off a job, the loader page polls
-- status, and the final result (keywords, plan, drafts) lands in
-- user_sites.settings.onboarding_result so the rest of the app can read it
-- without depending on this table.
CREATE TABLE IF NOT EXISTS onboarding_jobs (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id    uuid        NOT NULL,
  status     text        NOT NULL DEFAULT 'queued'
             CHECK (status IN ('queued','running','done','error')),
  -- Coarse milestone shown to the user on the loader page. Updated as
  -- each step in the generation pipeline finishes.
  step       text        NOT NULL DEFAULT 'queued',
  progress   int         NOT NULL DEFAULT 0
             CHECK (progress BETWEEN 0 AND 100),
  error      text,
  -- Full result payload (keywords, 30-day plan, 2 drafts). Kept on the
  -- job row so we can show partial results even if the user navigates
  -- away and back before the rest of the app catches up.
  result     jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_jobs_user_id_idx ON onboarding_jobs(user_id);
CREATE INDEX IF NOT EXISTS onboarding_jobs_site_id_idx ON onboarding_jobs(site_id);

ALTER TABLE onboarding_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own onboarding jobs"
  ON onboarding_jobs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on every write so the loader can show "last
-- progress at HH:MM:SS" if a job appears stuck.
CREATE OR REPLACE FUNCTION update_onboarding_jobs_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER onboarding_jobs_updated_at
  BEFORE UPDATE ON onboarding_jobs
  FOR EACH ROW EXECUTE FUNCTION update_onboarding_jobs_updated_at();
