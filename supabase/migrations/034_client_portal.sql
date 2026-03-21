-- Migration 034: Client Portal Foundation
-- External users (role = 'external') get a portal with most internal dashboard features
-- but limited access — no internal notes, no sensitive engagement data, etc.
-- Portal settings control per-org what's visible to external users.

-- ─── pm_portal_settings ──────────────────────────────────────────────
-- Per-org configuration for client portal visibility.
-- Each boolean controls whether that section is visible to external users.
CREATE TABLE IF NOT EXISTS pm_portal_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL UNIQUE REFERENCES pm_organizations(id) ON DELETE CASCADE,

  -- Feature visibility toggles
  show_projects       boolean DEFAULT true,   -- project list & detail
  show_phases         boolean DEFAULT true,   -- phase board
  show_tasks          boolean DEFAULT true,   -- task table (read-only by default)
  show_risks          boolean DEFAULT false,  -- risk register
  show_process_maps   boolean DEFAULT true,   -- process maps
  show_kpis           boolean DEFAULT true,   -- KPI dashboard
  show_documents      boolean DEFAULT true,   -- shared documents (SOPs, etc.)
  show_proposals      boolean DEFAULT true,   -- proposals sent to them
  show_reports        boolean DEFAULT false,  -- AI reports (rollup, blockers)
  show_daily_logs     boolean DEFAULT false,  -- standups
  show_engagements    boolean DEFAULT false,  -- engagement/deal info
  show_kb_articles    boolean DEFAULT true,   -- knowledge base (client-visible)

  -- Interaction permissions
  allow_task_comments boolean DEFAULT true,   -- can comment on tasks
  allow_file_uploads  boolean DEFAULT false,  -- can upload files
  allow_chat          boolean DEFAULT false,  -- can use AI chat

  -- Branding
  portal_title        text,                   -- custom portal title (default: org name)
  welcome_message     text,                   -- displayed on portal home
  primary_color       text,                   -- hex color for portal accent

  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ─── pm_portal_invites ───────────────────────────────────────────────
-- Track invitations sent to external users for portal access.
CREATE TABLE IF NOT EXISTS pm_portal_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  email       text NOT NULL,
  name        text,
  role        text DEFAULT 'viewer',   -- viewer or member within portal context
  invited_by  text,                    -- member slug of who sent it
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted_at timestamptz,
  expires_at  timestamptz DEFAULT (now() + interval '7 days'),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE pm_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_portal_invites ENABLE ROW LEVEL SECURITY;

-- Portal settings: internal can manage, external can read their own org
CREATE POLICY pm_portal_settings_internal_read ON pm_portal_settings
  FOR SELECT USING (pm_is_internal());
CREATE POLICY pm_portal_settings_internal_write ON pm_portal_settings
  FOR ALL USING (pm_is_internal_write());
CREATE POLICY pm_portal_settings_external_read ON pm_portal_settings
  FOR SELECT USING (pm_has_org_access(org_id));

-- Portal invites: internal only
CREATE POLICY pm_portal_invites_internal_read ON pm_portal_invites
  FOR SELECT USING (pm_is_internal());
CREATE POLICY pm_portal_invites_internal_write ON pm_portal_invites
  FOR ALL USING (pm_is_internal_write());

-- ─── Update client_notes visibility for portal ──────────────────────
-- Notes already have a visibility field (internal/client).
-- Portal will filter: only show visibility = 'client' notes to external users.
-- No schema change needed — just documenting the convention.

-- ─── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_settings_org ON pm_portal_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_portal_invites_org ON pm_portal_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_portal_invites_token ON pm_portal_invites(token);
CREATE INDEX IF NOT EXISTS idx_portal_invites_email ON pm_portal_invites(email);
