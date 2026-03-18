-- Knowledge Base: institutional memory for AI context
-- Three scopes: global (company-wide), org (client-specific), project (project-specific)

CREATE TABLE IF NOT EXISTS pm_kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES pm_organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES pm_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN (
      'company-profile',    -- Who we are, values, approach, brand voice
      'client-profile',     -- About the client, industry, key people, history
      'strategy',           -- Decision frameworks, strategic priorities, goals
      'playbook',           -- How we do things, standard processes, methodologies
      'lessons-learned',    -- Past experiences, what worked/didn't, retrospectives
      'industry',           -- Sector-specific knowledge, regulations, trends
      'relationship',       -- Relationship history, preferences, communication style
      'general'             -- Catch-all
    )),
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Scope rules: NULL org_id = global, org_id set = org-scoped, project_id set = project-scoped
  UNIQUE(COALESCE(org_id, '00000000-0000-0000-0000-000000000000'), COALESCE(project_id, '00000000-0000-0000-0000-000000000000'), slug)
);

CREATE INDEX IF NOT EXISTS idx_pm_kb_articles_org ON pm_kb_articles(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_kb_articles_project ON pm_kb_articles(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_kb_articles_category ON pm_kb_articles(category);
CREATE INDEX IF NOT EXISTS idx_pm_kb_articles_global ON pm_kb_articles((org_id IS NULL)) WHERE org_id IS NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION pm_kb_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pm_kb_articles_updated_at ON pm_kb_articles;
CREATE TRIGGER trg_pm_kb_articles_updated_at
  BEFORE UPDATE ON pm_kb_articles
  FOR EACH ROW EXECUTE FUNCTION pm_kb_articles_updated_at();

-- RLS (service role bypasses; match existing pattern)
ALTER TABLE pm_kb_articles ENABLE ROW LEVEL SECURITY;

-- Internal users: full access
CREATE POLICY kb_internal_read ON pm_kb_articles FOR SELECT TO authenticated
  USING (pm_is_internal());
CREATE POLICY kb_internal_write ON pm_kb_articles FOR ALL TO authenticated
  USING (pm_is_internal_write());

-- External users: read global + their org articles
CREATE POLICY kb_external_read ON pm_kb_articles FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR pm_has_org_access(org_id)
  );
