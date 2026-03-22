-- Adds priority column to pm_tasks for task prioritization
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_pm_tasks_priority ON pm_tasks(priority);
