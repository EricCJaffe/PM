-- Migration 032: Engagement Attachments + Discovery Task Templates
-- Adds: pm_engagement_attachments table for documents & supporting material on engagements
-- Seeds: additional discovery-phase engagement task templates

-- ─── 1. Engagement Attachments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_engagement_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id   UUID NOT NULL REFERENCES pm_engagements(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_size       INTEGER NOT NULL DEFAULT 0,
  content_type    TEXT,
  storage_path    TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'discovery', 'proposal', 'contract', 'intake', 'project-files', 'other')),
  description     TEXT,
  uploaded_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_engagement_attachments_engagement
  ON pm_engagement_attachments(engagement_id);

-- RLS
ALTER TABLE pm_engagement_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_engagement_attachments_internal_all" ON pm_engagement_attachments
  USING (pm_is_internal())
  WITH CHECK (pm_is_internal_write());

CREATE POLICY "pm_engagement_attachments_external_read" ON pm_engagement_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pm_engagements e
      WHERE e.id = engagement_id AND pm_has_org_access(e.org_id)
    )
  );

-- ─── 2. Additional Discovery Task Templates ─────────────────────────
-- These fill in the discovery workflow with actionable steps

INSERT INTO pm_engagement_task_templates (trigger_stage, title, description, due_offset_days, nudge_after_days, engagement_type, sort_order) VALUES
-- Lead stage additions
('lead', 'Research prospect company and industry', 'Look up their website, social media, and any publicly available info before first contact', 1, 1, 'new_prospect', 2),
('lead', 'Send introductory email or message', 'Craft personalized outreach with value proposition tailored to their vertical', 1, 1, 'new_prospect', 3),

-- Qualified stage additions
('qualified', 'Prepare discovery questionnaire', 'Review the intake form and tailor questions to their specific industry and needs', 0, 1, 'both', 2),
('qualified', 'Schedule next meeting', 'Book a follow-up session to review discovery findings and discuss next steps', 2, 1, 'both', 3),
('qualified', 'Run site audit (if website engagement)', 'Run a comprehensive site audit to identify opportunities', 3, 2, 'new_prospect', 4),
('qualified', 'Collect supporting documents from client', 'Request any existing SOPs, brand guides, analytics access, or relevant files', 3, 2, 'both', 5),

-- Discovery Complete additions
('discovery_complete', 'Compile discovery summary document', 'Consolidate all notes, audit results, and findings into a structured brief', 2, 1, 'both', 4),
('discovery_complete', 'Present discovery findings to client', 'Walk through findings and proposed approach before formal proposal', 3, 1, 'new_prospect', 5);
