-- ============================================================
--  Client Phase 1 — Buyer portal team access (multiple users per account)
--  Run AFTER main supabase/schema.sql in SQL Editor (or supabase db push).
-- ============================================================

CREATE TABLE IF NOT EXISTS buyer_account_members (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_profiles_id     UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  member_profile_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL DEFAULT 'manager'
                          CHECK (role IN ('owner','manager','viewer')),
  invited_email         TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','removed')),
  invited_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT buyer_account_members_email_or_user_ck
    CHECK (member_profile_id IS NOT NULL OR invited_email IS NOT NULL)
);

CREATE TRIGGER buyer_account_members_updated_at
  BEFORE UPDATE ON buyer_account_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_buyer_account_members_buyer
  ON buyer_account_members(buyer_profiles_id);

CREATE INDEX idx_buyer_account_members_profile
  ON buyer_account_members(member_profile_id);

CREATE UNIQUE INDEX buyer_account_members_one_active_user
  ON buyer_account_members (buyer_profiles_id, member_profile_id)
  WHERE member_profile_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX buyer_account_members_one_pending_email
  ON buyer_account_members (buyer_profiles_id, lower(trim(invited_email)))
  WHERE status = 'pending' AND invited_email IS NOT NULL;

ALTER TABLE buyer_account_members ENABLE ROW LEVEL SECURITY;

-- Account owner (buyer_profiles.profile_id) and active team members can read membership rows.
CREATE POLICY "buyer_team_select"
  ON buyer_account_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM buyer_profiles bp
      WHERE bp.id = buyer_account_members.buyer_profiles_id
        AND bp.profile_id = auth.uid()
    )
    OR member_profile_id = auth.uid()
  );

-- Only account owner (primary buyer_profiles row) can insert/update/delete team rows.
CREATE POLICY "buyer_team_manage_by_owner"
  ON buyer_account_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM buyer_profiles bp
      WHERE bp.id = buyer_account_members.buyer_profiles_id
        AND bp.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buyer_profiles bp
      WHERE bp.id = buyer_account_members.buyer_profiles_id
        AND bp.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access buyer_account_members"
  ON buyer_account_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

COMMENT ON TABLE buyer_account_members IS
  'Additional users invited to the same buyer wholesale account; owner remains buyer_profiles.profile_id.';
