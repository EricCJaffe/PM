-- BusinessOS PM — Auth System Upgrade
-- 1. Fix missing FK on pm_user_org_access.org_id
-- 2. Update system_role to admin|user|external
-- 3. Add user_id column to pm_members to link member records to auth users

-- ─── Fix pm_user_org_access.org_id FK ────────────────────────────────
ALTER TABLE pm_user_org_access
  ADD CONSTRAINT pm_user_org_access_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES pm_organizations(id) ON DELETE CASCADE;

-- ─── Update system_role CHECK constraint ─────────────────────────────
-- Drop old constraint and add new one with admin|user|external
ALTER TABLE pm_user_profiles
  DROP CONSTRAINT IF EXISTS pm_user_profiles_system_role_check;

ALTER TABLE pm_user_profiles
  ADD CONSTRAINT pm_user_profiles_system_role_check
  CHECK (system_role IN ('admin', 'user', 'external'));

-- Migrate any existing 'manager' roles to 'user', 'viewer' to 'external'
UPDATE pm_user_profiles SET system_role = 'user' WHERE system_role = 'manager';
UPDATE pm_user_profiles SET system_role = 'external' WHERE system_role = 'viewer';

-- ─── Add user_id to pm_members ───────────────────────────────────────
-- Links member records (used for task assignment) to auth users (used for login)
ALTER TABLE pm_members
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pm_members_user_id ON pm_members(user_id);

-- ─── Update pm_user_org_access role CHECK ────────────────────────────
-- Simplify to admin|member|viewer (drop 'manager')
ALTER TABLE pm_user_org_access
  DROP CONSTRAINT IF EXISTS pm_user_org_access_role_check;

ALTER TABLE pm_user_org_access
  ADD CONSTRAINT pm_user_org_access_role_check
  CHECK (role IN ('admin', 'member', 'viewer'));

-- Migrate any existing 'manager' org roles to 'admin'
UPDATE pm_user_org_access SET role = 'admin' WHERE role = 'manager';
