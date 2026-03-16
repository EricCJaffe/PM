-- Migration 010: Task comments, attachments, and standalone tasks
-- Adds: pm_task_comments, pm_task_attachments tables
-- Modifies: pm_tasks.project_id becomes nullable for standalone tasks

-- ─── Allow standalone tasks (no project) ─────────────────────────────
ALTER TABLE pm_tasks ALTER COLUMN project_id DROP NOT NULL;

-- Add assigned_to for My Tasks (member slug who the task is assigned to)
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- ─── Task Comments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_task_comments_task ON pm_task_comments(task_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION pm_task_comments_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pm_task_comments_updated_at ON pm_task_comments;
CREATE TRIGGER pm_task_comments_updated_at
  BEFORE UPDATE ON pm_task_comments
  FOR EACH ROW EXECUTE FUNCTION pm_task_comments_updated_at();

-- ─── Task Attachments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  content_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_task_attachments_task ON pm_task_attachments(task_id);
