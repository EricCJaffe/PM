-- Migration 052: Documentation workload telemetry events
-- Captures lightweight, PII-safe trigger events to measure recurring docs/training load.

CREATE TABLE IF NOT EXISTS pm_documentation_workload_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES pm_projects(id) ON DELETE SET NULL,
  engagement_id UUID REFERENCES pm_engagements(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN ('pass_approval', 'go_live', 'onboarding_completion', 'support_escalation')
  ),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trigger_type, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_workload_events_org_time
  ON pm_documentation_workload_events(org_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_workload_events_project_time
  ON pm_documentation_workload_events(project_id, occurred_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_workload_events_trigger_time
  ON pm_documentation_workload_events(trigger_type, occurred_at DESC);

ALTER TABLE pm_documentation_workload_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY doc_workload_internal_read ON pm_documentation_workload_events
    FOR SELECT USING (pm_is_internal());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY doc_workload_internal_write ON pm_documentation_workload_events
    FOR ALL USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION pm_log_documentation_workload_event(
  p_trigger_type TEXT,
  p_org_id UUID,
  p_project_id UUID,
  p_engagement_id UUID,
  p_source_table TEXT,
  p_source_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_occurred_at TIMESTAMPTZ DEFAULT now()
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO pm_documentation_workload_events (
    org_id,
    project_id,
    engagement_id,
    trigger_type,
    source_table,
    source_id,
    metadata,
    occurred_at
  ) VALUES (
    p_org_id,
    p_project_id,
    p_engagement_id,
    p_trigger_type,
    p_source_table,
    p_source_id,
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_occurred_at, now())
  )
  ON CONFLICT (trigger_type, source_table, source_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION pm_capture_web_pass_doc_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_trigger_type TEXT;
BEGIN
  IF NEW.status = 'approved' AND COALESCE(OLD.status, '') <> 'approved' THEN
    IF NEW.pass_type = 'go-live' THEN
      v_trigger_type := 'go_live';
    ELSE
      v_trigger_type := 'pass_approval';
    END IF;

    PERFORM pm_log_documentation_workload_event(
      v_trigger_type,
      NEW.org_id,
      NEW.project_id,
      NEW.engagement_id,
      'pm_web_passes',
      NEW.id,
      jsonb_build_object(
        'pass_type', NEW.pass_type,
        'pass_number', NEW.pass_number
      ),
      NEW.approved_at
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_web_pass_doc_event ON pm_web_passes;
CREATE TRIGGER trg_capture_web_pass_doc_event
AFTER UPDATE OF status ON pm_web_passes
FOR EACH ROW
EXECUTE FUNCTION pm_capture_web_pass_doc_event();

CREATE OR REPLACE FUNCTION pm_capture_onboarding_completion_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'complete' AND COALESCE(OLD.status, '') <> 'complete' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pm_onboarding_checklists c
      WHERE c.project_id = NEW.project_id
        AND c.is_required = true
        AND c.status <> 'complete'
    ) THEN
      PERFORM pm_log_documentation_workload_event(
        'onboarding_completion',
        NEW.org_id,
        NEW.project_id,
        NEW.engagement_id,
        'pm_projects',
        NEW.project_id,
        jsonb_build_object(
          'source', 'onboarding_checklist',
          'checklist_item_id', NEW.id
        ),
        NEW.completed_at
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_onboarding_completion_event ON pm_onboarding_checklists;
CREATE TRIGGER trg_capture_onboarding_completion_event
AFTER UPDATE OF status ON pm_onboarding_checklists
FOR EACH ROW
EXECUTE FUNCTION pm_capture_onboarding_completion_event();

CREATE OR REPLACE FUNCTION pm_capture_support_escalation_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.note_type = 'follow-up' THEN
    PERFORM pm_log_documentation_workload_event(
      'support_escalation',
      NEW.org_id,
      NEW.project_id,
      NULL,
      'pm_client_notes',
      NEW.id,
      jsonb_build_object(
        'note_type', NEW.note_type,
        'status', COALESCE(NEW.status, 'draft')
      ),
      NEW.created_at
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_support_escalation_event ON pm_client_notes;
CREATE TRIGGER trg_capture_support_escalation_event
AFTER INSERT ON pm_client_notes
FOR EACH ROW
EXECUTE FUNCTION pm_capture_support_escalation_event();
