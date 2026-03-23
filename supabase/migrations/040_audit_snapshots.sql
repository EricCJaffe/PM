-- =============================================================================
-- Migration 040: Audit Snapshots
-- Stores full audit report files (HTML + MD) for historical comparison.
-- The HTML is the full branded PDF-ready report; the MD is a structured
-- snapshot of all scores/gaps/recommendations for AI comparison.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pm_audit_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id         UUID NOT NULL REFERENCES pm_site_audits(id) ON DELETE CASCADE,
  org_id           UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  -- Storage paths in vault bucket
  html_storage_path TEXT,          -- Full branded HTML report
  md_storage_path   TEXT,          -- Structured markdown snapshot
  -- Denormalized score data for quick comparison queries
  overall_grade    TEXT,
  overall_score    INTEGER,
  dimension_scores JSONB,         -- { seo: 72, entity: 45, ... } flat scores for charting
  -- Metadata
  url              TEXT NOT NULL,
  vertical         TEXT NOT NULL,
  audit_date       DATE NOT NULL,  -- Date the audit was run
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_org ON pm_audit_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_audit ON pm_audit_snapshots(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_url ON pm_audit_snapshots(org_id, url, audit_date);

-- RLS
ALTER TABLE pm_audit_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_snapshots_select ON pm_audit_snapshots FOR SELECT
  USING (pm_is_internal() OR pm_has_org_access(org_id));
CREATE POLICY audit_snapshots_insert ON pm_audit_snapshots FOR INSERT
  WITH CHECK (pm_is_internal_write());
CREATE POLICY audit_snapshots_delete ON pm_audit_snapshots FOR DELETE
  USING (pm_is_internal_write());
