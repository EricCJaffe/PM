-- =============================================================================
-- Migration 052: Project-level Notes, Documents, and Comments
-- Adds standalone file storage and comment threads at the project level.
-- Notes reuse pm_client_notes (already has project_id) — we only extend the
-- note_type constraint and add the two new tables.
-- =============================================================================

-- ─── 1. Extend note_type to include 'decision' for project notes ─────────────
ALTER TABLE pm_client_notes
  DROP CONSTRAINT IF EXISTS pm_client_notes_note_type_check;
ALTER TABLE pm_client_notes
  ADD CONSTRAINT pm_client_notes_note_type_check
  CHECK (note_type IN ('meeting', 'general', 'phone-call', 'follow-up', 'client-update', 'decision'));

-- ─── 2. Project Documents — standalone file uploads at the project level ─────
CREATE TABLE IF NOT EXISTS pm_project_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_size     INTEGER,
  content_type  TEXT,
  storage_path  TEXT NOT NULL,
  title         TEXT,
  description   TEXT,
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_project_documents_project ON pm_project_documents (project_id, created_at DESC);

ALTER TABLE pm_project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_docs_internal_read ON pm_project_documents
  FOR SELECT USING (pm_is_internal());

CREATE POLICY project_docs_internal_write ON pm_project_documents
  FOR ALL USING (pm_is_internal_write());

-- ─── 3. Project Comments — threaded discussion at the project level ──────────
CREATE TABLE IF NOT EXISTS pm_project_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_project_comments_project ON pm_project_comments (project_id, created_at ASC);

ALTER TABLE pm_project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_comments_internal_read ON pm_project_comments
  FOR SELECT USING (pm_is_internal());

CREATE POLICY project_comments_internal_write ON pm_project_comments
  FOR ALL USING (pm_is_internal_write());
