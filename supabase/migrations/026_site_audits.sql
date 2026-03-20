-- =============================================================================
-- Migration 026: Site Audit Tool
-- Stores website audit results with scoring, gap analysis, and recommendations.
-- Links to engagements and orgs for pipeline integration.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pm_site_audits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  engagement_id    UUID REFERENCES pm_engagements(id) ON DELETE SET NULL,
  url              TEXT NOT NULL,
  vertical         TEXT NOT NULL CHECK (vertical IN ('church', 'agency', 'nonprofit', 'general')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  scores           JSONB,          -- { seo: "B", entity: "D", ... }
  gaps             JSONB,          -- { seo: [...], entity: [...], ... }
  recommendations  JSONB,          -- [{ title, priority, effort, impact }]
  quick_wins       JSONB,          -- [{ title, description }]
  pages_found      JSONB,          -- [{ url, title, status_code }]
  pages_to_build   JSONB,          -- [{ slug, title, reason }]
  raw_html         TEXT,           -- fetched homepage HTML (for re-analysis)
  extra_context    TEXT,           -- pasted-in context (GMB info, analytics, etc.)
  audit_summary    TEXT,           -- AI-generated executive summary
  document_id      UUID REFERENCES generated_documents(id) ON DELETE SET NULL,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_site_audits_org ON pm_site_audits(org_id);
CREATE INDEX IF NOT EXISTS idx_site_audits_engagement ON pm_site_audits(engagement_id);

-- Updated-at trigger
CREATE TRIGGER set_site_audits_updated_at
  BEFORE UPDATE ON pm_site_audits
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

-- RLS
ALTER TABLE pm_site_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_audits_select ON pm_site_audits FOR SELECT
  USING (pm_is_internal() OR pm_has_org_access(org_id));
CREATE POLICY site_audits_insert ON pm_site_audits FOR INSERT
  WITH CHECK (pm_is_internal_write());
CREATE POLICY site_audits_update ON pm_site_audits FOR UPDATE
  USING (pm_is_internal_write());
CREATE POLICY site_audits_delete ON pm_site_audits FOR DELETE
  USING (pm_is_internal_write());
