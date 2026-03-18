-- Migration 022: Client-level tasks + API key authentication
-- Adds: org_id column on pm_tasks (if missing), pm_api_keys table
-- Enables: tasks associated with a client but not a project, external AI agent access

-- ─── Ensure org_id exists on pm_tasks ───────────────────────────────
-- org_id may exist from earlier manual DB changes; add if not present
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES pm_organizations(id) ON DELETE CASCADE;

-- Index for client-level task queries (org_id set, project_id NULL)
CREATE INDEX IF NOT EXISTS idx_pm_tasks_org ON pm_tasks(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pm_tasks_client_level ON pm_tasks(org_id) WHERE org_id IS NOT NULL AND project_id IS NULL;

-- ─── API Keys for external integrations ─────────────────────────────
CREATE TABLE IF NOT EXISTS pm_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                              -- "OpenAI Assistant", "Zapier"
  key_hash TEXT NOT NULL UNIQUE,                   -- SHA-256 hash of actual key
  key_prefix TEXT NOT NULL,                        -- First 8 chars for display ("pm_key_a1b2...")
  permissions JSONB NOT NULL DEFAULT '{"read": ["orgs","projects","members","phases","tasks","notes"], "write": ["tasks","notes"]}',
  org_scope UUID[] DEFAULT NULL,                   -- NULL = all orgs, array = specific org IDs
  created_by TEXT,                                 -- member slug who created
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on pm_api_keys — admin-only
ALTER TABLE pm_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_api_keys_admin_all" ON pm_api_keys
  USING (pm_is_internal())
  WITH CHECK (pm_is_internal());
