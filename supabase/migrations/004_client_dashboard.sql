-- BusinessOS PM — Client Dashboard Extension
-- Process Maps, Opportunities, KPIs, Documents, Share Tokens

-- ─── Process Maps ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_process_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID REFERENCES pm_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  -- steps: [{ id, name, status, substeps: [{ name, done }] }]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- ─── Automation Opportunities ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID REFERENCES pm_projects(id) ON DELETE SET NULL,
  process_map_id UUID REFERENCES pm_process_maps(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_savings NUMERIC DEFAULT 0,
  savings_unit TEXT DEFAULT 'year'
    CHECK (savings_unit IN ('year', 'month', 'quarter', 'one-time')),
  complexity TEXT DEFAULT 'medium'
    CHECK (complexity IN ('low', 'medium', 'high')),
  estimated_timeline TEXT,
  priority_score INT DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
  status TEXT DEFAULT 'identified'
    CHECK (status IN ('identified', 'proposed', 'approved', 'in-progress', 'complete', 'declined')),
  source TEXT,
  owner TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- ─── KPIs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID REFERENCES pm_projects(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  current_value NUMERIC DEFAULT 0,
  target_value NUMERIC,
  unit TEXT DEFAULT '',
  trend TEXT DEFAULT 'flat' CHECK (trend IN ('up', 'down', 'flat')),
  period TEXT DEFAULT 'monthly' CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- ─── Documents / SOPs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID REFERENCES pm_projects(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'document'
    CHECK (category IN ('sop', 'document', 'report', 'template', 'policy', 'other')),
  department TEXT,
  description TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INT DEFAULT 0,
  mime_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- ─── Share Tokens ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID REFERENCES pm_projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  permissions TEXT DEFAULT 'read' CHECK (permissions IN ('read', 'read-comment')),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pm_process_maps_org ON pm_process_maps(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_opportunities_org ON pm_opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_kpis_org ON pm_kpis(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_documents_org ON pm_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_share_tokens_token ON pm_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pm_share_tokens_org ON pm_share_tokens(org_id);

-- ─── Updated-at Triggers ───────────────────────────────────────────
CREATE OR REPLACE TRIGGER pm_process_maps_updated_at
  BEFORE UPDATE ON pm_process_maps
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

CREATE OR REPLACE TRIGGER pm_opportunities_updated_at
  BEFORE UPDATE ON pm_opportunities
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

CREATE OR REPLACE TRIGGER pm_kpis_updated_at
  BEFORE UPDATE ON pm_kpis
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();
