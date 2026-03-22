-- Migration 037: Budget tracking columns on phases and tasks
-- Adds estimated_cost and actual_cost for budget vs actuals tracking

-- Phase-level cost tracking
ALTER TABLE pm_phases
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC DEFAULT NULL;

-- Task-level cost tracking
ALTER TABLE pm_tasks
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC DEFAULT NULL;

-- Index for quick budget rollup queries
CREATE INDEX IF NOT EXISTS idx_pm_tasks_project_costs
  ON pm_tasks (project_id)
  WHERE estimated_cost IS NOT NULL OR actual_cost IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pm_phases_project_costs
  ON pm_phases (project_id)
  WHERE estimated_cost IS NOT NULL OR actual_cost IS NOT NULL;
