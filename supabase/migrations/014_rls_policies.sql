-- BusinessOS PM — Row Level Security Policies
-- Enables RLS on all PM tables and defines access policies.
-- Idempotent: drops existing policies before recreating.
--
-- Access model:
--   admin  (system_role) → full CRUD on everything
--   user   (system_role) → full CRUD on everything (internal staff)
--   external (system_role) → read-only, scoped to assigned orgs via pm_user_org_access
--   anon   → no access
--   service_role → bypasses RLS automatically (used by API routes)

-- ─── Helper: check if the authenticated user is admin or internal user ───
CREATE OR REPLACE FUNCTION pm_is_internal()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pm_user_profiles
    WHERE id = auth.uid()
      AND system_role IN ('admin', 'user')
  );
$$;

-- ─── Helper: check if the authenticated user has access to a given org ───
CREATE OR REPLACE FUNCTION pm_has_org_access(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Internal users (admin/user) can access all orgs
    pm_is_internal()
    OR
    -- External users need an explicit org access row
    EXISTS (
      SELECT 1 FROM pm_user_org_access
      WHERE user_id = auth.uid()
        AND org_id = check_org_id
    );
$$;

-- ─── Helper: check org access via project_id ────────────────────────────
CREATE OR REPLACE FUNCTION pm_has_project_access(check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pm_is_internal()
    OR
    EXISTS (
      SELECT 1 FROM pm_projects p
      JOIN pm_user_org_access uoa ON uoa.org_id = p.org_id
      WHERE p.id = check_project_id
        AND uoa.user_id = auth.uid()
    );
$$;

-- ─── Helper: is the user an internal (admin/user) role? For write policies ──
CREATE OR REPLACE FUNCTION pm_is_internal_write()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pm_is_internal();
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. pm_organizations
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_organizations_select" ON pm_organizations;
DROP POLICY IF EXISTS "pm_organizations_insert" ON pm_organizations;
DROP POLICY IF EXISTS "pm_organizations_update" ON pm_organizations;
DROP POLICY IF EXISTS "pm_organizations_delete" ON pm_organizations;

CREATE POLICY "pm_organizations_select" ON pm_organizations
  FOR SELECT USING (pm_has_org_access(id));

CREATE POLICY "pm_organizations_insert" ON pm_organizations
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_organizations_update" ON pm_organizations
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_organizations_delete" ON pm_organizations
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. pm_members (direct org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_members_select" ON pm_members;
DROP POLICY IF EXISTS "pm_members_insert" ON pm_members;
DROP POLICY IF EXISTS "pm_members_update" ON pm_members;
DROP POLICY IF EXISTS "pm_members_delete" ON pm_members;

CREATE POLICY "pm_members_select" ON pm_members
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY "pm_members_insert" ON pm_members
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_members_update" ON pm_members
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_members_delete" ON pm_members
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. pm_projects (direct org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_projects_select" ON pm_projects;
DROP POLICY IF EXISTS "pm_projects_insert" ON pm_projects;
DROP POLICY IF EXISTS "pm_projects_update" ON pm_projects;
DROP POLICY IF EXISTS "pm_projects_delete" ON pm_projects;

CREATE POLICY "pm_projects_select" ON pm_projects
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY "pm_projects_insert" ON pm_projects
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_projects_update" ON pm_projects
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_projects_delete" ON pm_projects
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. pm_phases (via project_id → projects.org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_phases_select" ON pm_phases;
DROP POLICY IF EXISTS "pm_phases_insert" ON pm_phases;
DROP POLICY IF EXISTS "pm_phases_update" ON pm_phases;
DROP POLICY IF EXISTS "pm_phases_delete" ON pm_phases;

CREATE POLICY "pm_phases_select" ON pm_phases
  FOR SELECT USING (pm_has_project_access(project_id));

CREATE POLICY "pm_phases_insert" ON pm_phases
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_phases_update" ON pm_phases
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_phases_delete" ON pm_phases
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. pm_tasks (via project_id → projects.org_id, may be NULL for standalone)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_tasks_select" ON pm_tasks;
DROP POLICY IF EXISTS "pm_tasks_insert" ON pm_tasks;
DROP POLICY IF EXISTS "pm_tasks_update" ON pm_tasks;
DROP POLICY IF EXISTS "pm_tasks_delete" ON pm_tasks;

-- Tasks with a project: check project org access
-- Standalone tasks (project_id IS NULL): only internal users
CREATE POLICY "pm_tasks_select" ON pm_tasks
  FOR SELECT USING (
    CASE
      WHEN project_id IS NOT NULL THEN pm_has_project_access(project_id)
      ELSE pm_is_internal()
    END
  );

CREATE POLICY "pm_tasks_insert" ON pm_tasks
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_tasks_update" ON pm_tasks
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_tasks_delete" ON pm_tasks
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. pm_risks (via project_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_risks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_risks_select" ON pm_risks;
DROP POLICY IF EXISTS "pm_risks_insert" ON pm_risks;
DROP POLICY IF EXISTS "pm_risks_update" ON pm_risks;
DROP POLICY IF EXISTS "pm_risks_delete" ON pm_risks;

CREATE POLICY "pm_risks_select" ON pm_risks
  FOR SELECT USING (pm_has_project_access(project_id));

CREATE POLICY "pm_risks_insert" ON pm_risks
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_risks_update" ON pm_risks
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_risks_delete" ON pm_risks
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. pm_daily_logs (via project_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_daily_logs_select" ON pm_daily_logs;
DROP POLICY IF EXISTS "pm_daily_logs_insert" ON pm_daily_logs;
DROP POLICY IF EXISTS "pm_daily_logs_update" ON pm_daily_logs;
DROP POLICY IF EXISTS "pm_daily_logs_delete" ON pm_daily_logs;

CREATE POLICY "pm_daily_logs_select" ON pm_daily_logs
  FOR SELECT USING (pm_has_project_access(project_id));

CREATE POLICY "pm_daily_logs_insert" ON pm_daily_logs
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_daily_logs_update" ON pm_daily_logs
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_daily_logs_delete" ON pm_daily_logs
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. pm_files (via project_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_files_select" ON pm_files;
DROP POLICY IF EXISTS "pm_files_insert" ON pm_files;
DROP POLICY IF EXISTS "pm_files_update" ON pm_files;
DROP POLICY IF EXISTS "pm_files_delete" ON pm_files;

CREATE POLICY "pm_files_select" ON pm_files
  FOR SELECT USING (pm_has_project_access(project_id));

CREATE POLICY "pm_files_insert" ON pm_files
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_files_update" ON pm_files
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_files_delete" ON pm_files
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. pm_task_comments (via task_id → tasks.project_id → projects.org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_task_comments_select" ON pm_task_comments;
DROP POLICY IF EXISTS "pm_task_comments_insert" ON pm_task_comments;
DROP POLICY IF EXISTS "pm_task_comments_update" ON pm_task_comments;
DROP POLICY IF EXISTS "pm_task_comments_delete" ON pm_task_comments;

CREATE POLICY "pm_task_comments_select" ON pm_task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pm_tasks t
      WHERE t.id = task_id
        AND (
          (t.project_id IS NOT NULL AND pm_has_project_access(t.project_id))
          OR (t.project_id IS NULL AND pm_is_internal())
        )
    )
  );

CREATE POLICY "pm_task_comments_insert" ON pm_task_comments
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_task_comments_update" ON pm_task_comments
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_task_comments_delete" ON pm_task_comments
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. pm_task_attachments (via task_id → tasks.project_id → projects.org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_task_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_task_attachments_select" ON pm_task_attachments;
DROP POLICY IF EXISTS "pm_task_attachments_insert" ON pm_task_attachments;
DROP POLICY IF EXISTS "pm_task_attachments_update" ON pm_task_attachments;
DROP POLICY IF EXISTS "pm_task_attachments_delete" ON pm_task_attachments;

CREATE POLICY "pm_task_attachments_select" ON pm_task_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pm_tasks t
      WHERE t.id = task_id
        AND (
          (t.project_id IS NOT NULL AND pm_has_project_access(t.project_id))
          OR (t.project_id IS NULL AND pm_is_internal())
        )
    )
  );

CREATE POLICY "pm_task_attachments_insert" ON pm_task_attachments
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_task_attachments_update" ON pm_task_attachments
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_task_attachments_delete" ON pm_task_attachments
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. pm_task_series (direct org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_task_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_task_series_select" ON pm_task_series;
DROP POLICY IF EXISTS "pm_task_series_insert" ON pm_task_series;
DROP POLICY IF EXISTS "pm_task_series_update" ON pm_task_series;
DROP POLICY IF EXISTS "pm_task_series_delete" ON pm_task_series;

CREATE POLICY "pm_task_series_select" ON pm_task_series
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY "pm_task_series_insert" ON pm_task_series
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_task_series_update" ON pm_task_series
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_task_series_delete" ON pm_task_series
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 12. pm_series_exceptions (via series_id → task_series.org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_series_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_series_exceptions_select" ON pm_series_exceptions;
DROP POLICY IF EXISTS "pm_series_exceptions_insert" ON pm_series_exceptions;
DROP POLICY IF EXISTS "pm_series_exceptions_update" ON pm_series_exceptions;
DROP POLICY IF EXISTS "pm_series_exceptions_delete" ON pm_series_exceptions;

CREATE POLICY "pm_series_exceptions_select" ON pm_series_exceptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pm_task_series s
      WHERE s.id = series_id
        AND pm_has_org_access(s.org_id)
    )
  );

CREATE POLICY "pm_series_exceptions_insert" ON pm_series_exceptions
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_series_exceptions_update" ON pm_series_exceptions
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_series_exceptions_delete" ON pm_series_exceptions
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 13. pm_process_maps (direct org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_process_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_process_maps_select" ON pm_process_maps;
DROP POLICY IF EXISTS "pm_process_maps_insert" ON pm_process_maps;
DROP POLICY IF EXISTS "pm_process_maps_update" ON pm_process_maps;
DROP POLICY IF EXISTS "pm_process_maps_delete" ON pm_process_maps;

CREATE POLICY "pm_process_maps_select" ON pm_process_maps
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY "pm_process_maps_insert" ON pm_process_maps
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_process_maps_update" ON pm_process_maps
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_process_maps_delete" ON pm_process_maps
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 14. pm_opportunities (direct org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_opportunities_select" ON pm_opportunities;
DROP POLICY IF EXISTS "pm_opportunities_insert" ON pm_opportunities;
DROP POLICY IF EXISTS "pm_opportunities_update" ON pm_opportunities;
DROP POLICY IF EXISTS "pm_opportunities_delete" ON pm_opportunities;

CREATE POLICY "pm_opportunities_select" ON pm_opportunities
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY "pm_opportunities_insert" ON pm_opportunities
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_opportunities_update" ON pm_opportunities
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_opportunities_delete" ON pm_opportunities
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 15. pm_kpis (direct org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_kpis_select" ON pm_kpis;
DROP POLICY IF EXISTS "pm_kpis_insert" ON pm_kpis;
DROP POLICY IF EXISTS "pm_kpis_update" ON pm_kpis;
DROP POLICY IF EXISTS "pm_kpis_delete" ON pm_kpis;

CREATE POLICY "pm_kpis_select" ON pm_kpis
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY "pm_kpis_insert" ON pm_kpis
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_kpis_update" ON pm_kpis
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_kpis_delete" ON pm_kpis
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 16. pm_documents (direct org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_documents_select" ON pm_documents;
DROP POLICY IF EXISTS "pm_documents_insert" ON pm_documents;
DROP POLICY IF EXISTS "pm_documents_update" ON pm_documents;
DROP POLICY IF EXISTS "pm_documents_delete" ON pm_documents;

CREATE POLICY "pm_documents_select" ON pm_documents
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY "pm_documents_insert" ON pm_documents
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_documents_update" ON pm_documents
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_documents_delete" ON pm_documents
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 17. pm_share_tokens (direct org_id)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_share_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_share_tokens_select" ON pm_share_tokens;
DROP POLICY IF EXISTS "pm_share_tokens_insert" ON pm_share_tokens;
DROP POLICY IF EXISTS "pm_share_tokens_update" ON pm_share_tokens;
DROP POLICY IF EXISTS "pm_share_tokens_delete" ON pm_share_tokens;

CREATE POLICY "pm_share_tokens_select" ON pm_share_tokens
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY "pm_share_tokens_insert" ON pm_share_tokens
  FOR INSERT WITH CHECK (pm_is_internal());

CREATE POLICY "pm_share_tokens_update" ON pm_share_tokens
  FOR UPDATE USING (pm_is_internal());

CREATE POLICY "pm_share_tokens_delete" ON pm_share_tokens
  FOR DELETE USING (pm_is_internal());


-- ═══════════════════════════════════════════════════════════════════════════
-- 18. pm_user_profiles (users can read their own; admins can read all)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_user_profiles_select" ON pm_user_profiles;
DROP POLICY IF EXISTS "pm_user_profiles_insert" ON pm_user_profiles;
DROP POLICY IF EXISTS "pm_user_profiles_update" ON pm_user_profiles;
DROP POLICY IF EXISTS "pm_user_profiles_delete" ON pm_user_profiles;

-- Users can always read their own profile; internal users can read all
CREATE POLICY "pm_user_profiles_select" ON pm_user_profiles
  FOR SELECT USING (
    id = auth.uid() OR pm_is_internal()
  );

-- Users can update their own profile; admins can update any
CREATE POLICY "pm_user_profiles_update" ON pm_user_profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );

-- Only admins can insert/delete profiles
CREATE POLICY "pm_user_profiles_insert" ON pm_user_profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );

CREATE POLICY "pm_user_profiles_delete" ON pm_user_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- 19. pm_user_org_access (users see their own rows; admins see all)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_user_org_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_user_org_access_select" ON pm_user_org_access;
DROP POLICY IF EXISTS "pm_user_org_access_insert" ON pm_user_org_access;
DROP POLICY IF EXISTS "pm_user_org_access_update" ON pm_user_org_access;
DROP POLICY IF EXISTS "pm_user_org_access_delete" ON pm_user_org_access;

CREATE POLICY "pm_user_org_access_select" ON pm_user_org_access
  FOR SELECT USING (
    user_id = auth.uid() OR pm_is_internal()
  );

-- Only admins can manage org access
CREATE POLICY "pm_user_org_access_insert" ON pm_user_org_access
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );

CREATE POLICY "pm_user_org_access_update" ON pm_user_org_access
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );

CREATE POLICY "pm_user_org_access_delete" ON pm_user_org_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- 20. pm_project_templates (global read for all authenticated users)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE pm_project_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_project_templates_select" ON pm_project_templates;
DROP POLICY IF EXISTS "pm_project_templates_insert" ON pm_project_templates;
DROP POLICY IF EXISTS "pm_project_templates_update" ON pm_project_templates;
DROP POLICY IF EXISTS "pm_project_templates_delete" ON pm_project_templates;

-- All authenticated users can read templates
CREATE POLICY "pm_project_templates_select" ON pm_project_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can manage templates
CREATE POLICY "pm_project_templates_insert" ON pm_project_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );

CREATE POLICY "pm_project_templates_update" ON pm_project_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );

CREATE POLICY "pm_project_templates_delete" ON pm_project_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pm_user_profiles
      WHERE id = auth.uid() AND system_role = 'admin'
    )
  );
