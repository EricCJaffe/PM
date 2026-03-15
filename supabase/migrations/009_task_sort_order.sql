-- BusinessOS PM — Task ordering support
-- Run each statement separately if needed

ALTER TABLE pm_tasks
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
