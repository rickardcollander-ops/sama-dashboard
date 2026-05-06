-- account_members: links Supabase auth users to "accounts" (multi-user accounts).
--
-- Model:
--   "account_id" is the user.id of the account OWNER. This preserves all existing
--   tenant data on the backend (which keys off user.id) while letting additional
--   users join the same account as members.
--
--   Every owner has a self-row (account_id = user_id, role = 'owner', status = 'active').
--   It's created automatically by the trigger below the first time the user
--   sees the dashboard, and it's also seeded for existing users by the backfill
--   at the bottom of this file.
--
--   Invited members start as status = 'pending' with user_id = NULL and an
--   invited_email value. When they sign up / accept the invite, the API
--   patches user_id to their auth.users.id and flips status to 'active'.

CREATE TABLE IF NOT EXISTS account_members (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id      uuid        NOT NULL,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email   text,
  role            text        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  invited_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  CONSTRAINT account_members_user_or_email CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS account_members_account_user_uniq
  ON account_members(account_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_members_account_email_uniq
  ON account_members(account_id, lower(invited_email))
  WHERE invited_email IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS account_members_user_idx ON account_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS account_members_email_idx ON account_members(lower(invited_email)) WHERE invited_email IS NOT NULL;

ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;

-- Helper: returns true when the calling auth.uid() is an active member of
-- account_id. SECURITY DEFINER so the function bypasses the table's own RLS
-- to avoid recursion when the policies reference it.
CREATE OR REPLACE FUNCTION is_account_member(account uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_members
    WHERE account_id = account
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_account_admin(account uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_members
    WHERE account_id = account
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION is_account_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_account_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_account_member(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION is_account_admin(uuid) TO authenticated, anon, service_role;

-- Members read all rows for accounts they belong to.
DROP POLICY IF EXISTS "members read own account" ON account_members;
CREATE POLICY "members read own account"
  ON account_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR account_id = auth.uid()           -- owner sees their account
    OR is_account_admin(account_id)
  );

-- Owners/admins can write member rows for their account.
DROP POLICY IF EXISTS "admins manage members" ON account_members;
CREATE POLICY "admins manage members"
  ON account_members FOR ALL
  USING (account_id = auth.uid() OR is_account_admin(account_id))
  WITH CHECK (account_id = auth.uid() OR is_account_admin(account_id));

-- Self-acceptance: a logged-in user can flip a pending invite for their email
-- into themselves. Application code should still go through /api/account/accept-invite
-- (service role) because account_members rows for unknown users have user_id = NULL
-- and RLS won't help match by email reliably; this policy is a belt-and-braces.
DROP POLICY IF EXISTS "self accept invite" ON account_members;
CREATE POLICY "self accept invite"
  ON account_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Update RLS on user_sites so members can access the owner's sites ────────
DROP POLICY IF EXISTS "Users manage own sites" ON user_sites;

CREATE POLICY "Members read account sites"
  ON user_sites FOR SELECT
  USING (user_id = auth.uid() OR is_account_member(user_id));

CREATE POLICY "Members write account sites"
  ON user_sites FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_account_member(user_id));

CREATE POLICY "Members update account sites"
  ON user_sites FOR UPDATE
  USING (user_id = auth.uid() OR is_account_member(user_id))
  WITH CHECK (user_id = auth.uid() OR is_account_member(user_id));

CREATE POLICY "Owners delete account sites"
  ON user_sites FOR DELETE
  USING (user_id = auth.uid() OR is_account_admin(user_id));

-- ── Update RLS on user_settings so members can read/write the owner's settings ─
DROP POLICY IF EXISTS "Users can read own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

CREATE POLICY "Members read account settings"
  ON user_settings FOR SELECT
  USING (user_id = auth.uid() OR is_account_member(user_id));

CREATE POLICY "Members insert account settings"
  ON user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_account_member(user_id));

CREATE POLICY "Members update account settings"
  ON user_settings FOR UPDATE
  USING (user_id = auth.uid() OR is_account_member(user_id))
  WITH CHECK (user_id = auth.uid() OR is_account_member(user_id));

-- ── Auto-seed an "owner" row whenever a new auth.users row is created ───────
CREATE OR REPLACE FUNCTION seed_owner_account_member()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
  VALUES (NEW.id, NEW.id, 'owner', 'active', now())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_seed_owner ON auth.users;
CREATE TRIGGER on_auth_user_created_seed_owner
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION seed_owner_account_member();

-- ── Backfill existing users so they each have an owner-self row ──────────────
INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
SELECT u.id, u.id, 'owner', 'active', now()
FROM auth.users u
ON CONFLICT DO NOTHING;
