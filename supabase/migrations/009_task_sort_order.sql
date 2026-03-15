-- BusinessOS PM — Task ordering support
-- Adds sort_order column to pm_tasks for drag-and-drop reordering

ALTER TABLE pm_tasks
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- Backfill existing tasks with sequential order within each phase
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY phase_id ORDER BY created_at) - 1 AS rn
  FROM pm_tasks
)
UPDATE pm_tasks SET sort_order = ordered.rn
FROM ordered WHERE pm_tasks.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_pm_tasks_sort_order ON pm_tasks(phase_id, sort_order);
