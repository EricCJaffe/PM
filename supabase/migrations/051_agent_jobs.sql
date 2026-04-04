-- =============================================================================
-- Migration 051: Agent Jobs — background AI job queue
-- Enables autonomous agent work: scheduled + event-triggered AI tasks
-- per org. Follows the Paperclip heartbeat pattern without the overhead
-- of a separate service.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pm_agent_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES pm_organizations(id) ON DELETE CASCADE,
  job_type      TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','complete','failed','skipped')),
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  result        JSONB,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup for the runner: pending jobs ready to execute
CREATE INDEX IF NOT EXISTS pm_agent_jobs_status_scheduled
  ON pm_agent_jobs (status, scheduled_at)
  WHERE status = 'pending';

-- Per-org job history
CREATE INDEX IF NOT EXISTS pm_agent_jobs_org_type
  ON pm_agent_jobs (org_id, job_type, created_at DESC);

-- RLS: service role only (these are internal jobs, not user-facing queries)
ALTER TABLE pm_agent_jobs ENABLE ROW LEVEL SECURITY;

-- ── Extend pm_gap_analysis to track which audit produced items ────────────────
ALTER TABLE pm_gap_analysis
  ADD COLUMN IF NOT EXISTS source_audit_id UUID REFERENCES pm_site_audits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pm_gap_analysis_source_audit
  ON pm_gap_analysis (source_audit_id)
  WHERE source_audit_id IS NOT NULL;

-- Service role bypass (for API routes using createServiceClient)
CREATE POLICY "service_role_full_access" ON pm_agent_jobs
  USING (true) WITH CHECK (true);
