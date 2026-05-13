-- ============================================================
-- PATCH: Member access to shared account sites and settings
-- ============================================================
-- Run this once in the Supabase SQL editor.
-- Safe to re-run: all statements are DROP IF EXISTS / CREATE OR REPLACE.
--
-- What it does:
--   1. Ensures is_account_member() and is_account_admin() helpers exist
--   2. Replaces the restrictive "users see only own rows" policies on
--      user_sites and user_settings with member-aware equivalents
--   3. Seeds an owner-row in account_members for every existing user
--      (idempotent: ON CONFLICT DO NOTHING)
-- ============================================================

-- ── 1. Helper functions ─────────────────────────────────────────────────────

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

-- ── 2. user_sites RLS ────────────────────────────────────────────────────────
-- Replace the old owner-only policy with member-aware policies.

DROP POLICY IF EXISTS "Users manage own sites" ON user_sites;
DROP POLICY IF EXISTS "Members read account sites" ON user_sites;
DROP POLICY IF EXISTS "Members write account sites" ON user_sites;
DROP POLICY IF EXISTS "Members update account sites" ON user_sites;
DROP POLICY IF EXISTS "Owners delete account sites" ON user_sites;

-- Members can read all sites belonging to accounts they're active in.
CREATE POLICY "Members read account sites"
  ON user_sites FOR SELECT
  USING (user_id = auth.uid() OR is_account_member(user_id));

-- Members can insert new sites into accounts they belong to.
CREATE POLICY "Members write account sites"
  ON user_sites FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_account_member(user_id));

-- Members can update sites belonging to their accounts.
CREATE POLICY "Members update account sites"
  ON user_sites FOR UPDATE
  USING  (user_id = auth.uid() OR is_account_member(user_id))
  WITH CHECK (user_id = auth.uid() OR is_account_member(user_id));

-- Only owners/admins can delete sites.
CREATE POLICY "Owners delete account sites"
  ON user_sites FOR DELETE
  USING (user_id = auth.uid() OR is_account_admin(user_id));

-- ── 3. user_settings RLS ─────────────────────────────────────────────────────
-- Same pattern: replace owner-only policies with member-aware equivalents.

DROP POLICY IF EXISTS "Users can read own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Members read account settings" ON user_settings;
DROP POLICY IF EXISTS "Members insert account settings" ON user_settings;
DROP POLICY IF EXISTS "Members update account settings" ON user_settings;

CREATE POLICY "Members read account settings"
  ON user_settings FOR SELECT
  USING (user_id = auth.uid() OR is_account_member(user_id));

CREATE POLICY "Members insert account settings"
  ON user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_account_member(user_id));

CREATE POLICY "Members update account settings"
  ON user_settings FOR UPDATE
  USING  (user_id = auth.uid() OR is_account_member(user_id))
  WITH CHECK (user_id = auth.uid() OR is_account_member(user_id));

-- ── 4. Seed owner-rows for existing users ────────────────────────────────────
-- Every user must have a self-row in account_members (role='owner') so the
-- account switcher always shows at least their own account. New users get
-- this row from the trigger in supabase-account-members.sql; this backfills
-- anyone who signed up before that trigger was installed.

INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
SELECT u.id, u.id, 'owner', 'active', now()
FROM auth.users u
ON CONFLICT DO NOTHING;
