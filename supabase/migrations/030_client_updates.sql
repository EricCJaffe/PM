-- =============================================================================
-- Migration 030: Client Update Generator
-- Adds columns to pm_client_notes for tracking client update emails:
-- status, sent_at, sent_to_email, sent_to_name, project_id, period dates, subject.
-- Expands note_type CHECK to include 'client-update'.
-- =============================================================================

-- 1. Add client update tracking columns
ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'archived'));

ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS sent_to_email TEXT;

ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS sent_to_name TEXT;

ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES pm_projects(id) ON DELETE SET NULL;

ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS period_start DATE;

ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS period_end DATE;

ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS subject TEXT;

-- 2. Expand note_type CHECK to include 'client-update'
ALTER TABLE pm_client_notes
  DROP CONSTRAINT IF EXISTS pm_client_notes_note_type_check;

ALTER TABLE pm_client_notes
  ADD CONSTRAINT pm_client_notes_note_type_check
  CHECK (note_type IN ('meeting', 'general', 'phone-call', 'follow-up', 'client-update'));

-- 3. Indexes for client update queries
CREATE INDEX IF NOT EXISTS pm_client_notes_project_idx
  ON pm_client_notes(project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pm_client_notes_status_idx
  ON pm_client_notes(org_id, status);
