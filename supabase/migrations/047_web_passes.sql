-- Migration 047: Web Design Pass System
-- Tables: pm_web_passes, pm_web_pass_comments

CREATE TABLE pm_web_passes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID        NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  org_id              UUID        NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  pass_number         INT         NOT NULL CHECK (pass_number BETWEEN 0 AND 4),
  -- 0=discovery, 1=foundation, 2=content, 3=polish, 4=go-live
  pass_type           TEXT        NOT NULL CHECK (pass_type IN (
    'discovery', 'foundation', 'content', 'polish', 'go-live'
  )),
  status              TEXT        NOT NULL DEFAULT 'locked' CHECK (status IN (
    'locked', 'active', 'in-review', 'approved', 'rejected'
  )),
  form_data           JSONB       NOT NULL DEFAULT '{}',
  deliverable_html    TEXT,
  deliverable_html_b  TEXT,
  selected_option     TEXT        CHECK (selected_option IN ('a', 'b')),
  share_token         TEXT        UNIQUE,
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  scoring_results     JSONB,
  site_audit_id       UUID        REFERENCES pm_site_audits(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, pass_number)
);

CREATE TABLE pm_web_pass_comments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id         UUID        NOT NULL REFERENCES pm_web_passes(id) ON DELETE CASCADE,
  section_id      TEXT        NOT NULL,
  section_label   TEXT,
  feedback_type   TEXT        NOT NULL CHECK (feedback_type IN (
    'approve', 'comment', 'request-change'
  )),
  comment         TEXT,
  commenter_name  TEXT,
  commenter_email TEXT,
  is_resolved     BOOLEAN     NOT NULL DEFAULT false,
  resolved_by     TEXT,
  resolved_at     TIMESTAMPTZ,
  ai_applied      BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE TRIGGER pm_web_passes_updated_at
  BEFORE UPDATE ON pm_web_passes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_web_passes_org      ON pm_web_passes(org_id);
CREATE INDEX idx_web_passes_project  ON pm_web_passes(project_id);
CREATE INDEX idx_web_passes_token    ON pm_web_passes(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_web_pass_comments_pass    ON pm_web_pass_comments(pass_id);
CREATE INDEX idx_web_pass_comments_section ON pm_web_pass_comments(pass_id, section_id);

-- RLS
ALTER TABLE pm_web_passes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_web_pass_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY web_passes_internal_read  ON pm_web_passes FOR SELECT USING (pm_is_internal());
CREATE POLICY web_passes_internal_write ON pm_web_passes FOR ALL    USING (pm_is_internal_write());
CREATE POLICY web_passes_external_read  ON pm_web_passes FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY web_pass_comments_internal_read  ON pm_web_pass_comments FOR SELECT USING (pm_is_internal());
CREATE POLICY web_pass_comments_internal_write ON pm_web_pass_comments FOR ALL    USING (pm_is_internal_write());
-- Public (token-based) comment inserts are handled at API level with service role
