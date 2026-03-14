-- BusinessOS PM — User Roles & Auth Integration
-- Maps Supabase auth.users to PM roles

CREATE TABLE IF NOT EXISTS pm_user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  system_role TEXT NOT NULL DEFAULT 'user'
    CHECK (system_role IN ('admin', 'manager', 'user', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Link users to orgs with roles
CREATE TABLE IF NOT EXISTS pm_user_org_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_user_profiles_email ON pm_user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_pm_user_org_access_user ON pm_user_org_access(user_id);
CREATE INDEX IF NOT EXISTS idx_pm_user_org_access_org ON pm_user_org_access(org_id);

CREATE OR REPLACE TRIGGER pm_user_profiles_updated_at
  BEFORE UPDATE ON pm_user_profiles
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();
