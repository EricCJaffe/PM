-- 012: Recurring tasks — series, instances, exceptions
--
-- Design:
--   pm_task_series  = the "template" defining a recurring pattern
--   pm_tasks        = individual instances (linked via series_id)
--   pm_series_exceptions = skipped/rescheduled dates
--
-- Recurrence is modeled with normalized fields (not just RRULE strings)
-- so Postgres can validate, query, and index recurrence data directly.

-- ─── Task Series (recurring task templates) ─────────────────────────────
CREATE TABLE IF NOT EXISTS pm_task_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context — same as pm_tasks
  project_id UUID REFERENCES pm_projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES pm_phases(id) ON DELETE SET NULL,
  org_id UUID REFERENCES pm_organizations(id) ON DELETE CASCADE,

  -- Template fields copied into each generated instance
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  assigned_to TEXT,
  status_template TEXT NOT NULL DEFAULT 'not-started'
    CHECK (status_template IN ('not-started','in-progress','complete','blocked','pending','on-hold')),
  subtasks_template JSONB DEFAULT '[]',

  -- ─── Recurrence rule (normalized iCal-inspired fields) ──────────────
  recurrence_mode TEXT NOT NULL DEFAULT 'fixed'
    CHECK (recurrence_mode IN ('fixed', 'completion')),
  -- fixed     = schedule-based (e.g. every Monday)
  -- completion = next occurrence N days after previous instance completes

  freq TEXT NOT NULL
    CHECK (freq IN ('daily', 'weekly', 'monthly', 'yearly')),

  "interval" INT NOT NULL DEFAULT 1 CHECK ("interval" >= 1),
  -- e.g. interval=2 + freq=weekly → every 2 weeks

  by_weekday INT[] DEFAULT '{}',
  -- 0=Sunday, 1=Monday, ... 6=Saturday
  -- For "every weekday": {1,2,3,4,5}
  -- For "every Monday and Wednesday": {1,3}

  by_monthday INT[] DEFAULT '{}',
  -- Day-of-month: {1} = 1st of month, {15} = 15th, {-1} = last day

  by_setpos INT,
  -- Ordinal position modifier for by_weekday in monthly/yearly rules
  -- 1=first, 2=second, 3=third, 4=fourth, -1=last, -2=second-to-last
  -- e.g. by_setpos=1, by_weekday={1}, freq=monthly → first Monday of month
  -- e.g. by_setpos=-1, by_weekday={5}, freq=monthly → last Friday of month

  -- ─── Schedule bounds ────────────────────────────────────────────────
  dtstart DATE NOT NULL DEFAULT CURRENT_DATE,
  -- First occurrence date

  until_date DATE,
  -- End date (NULL = never ends). Mutually exclusive with max_count.

  max_count INT,
  -- Stop after N occurrences (NULL = no limit). Mutually exclusive with until_date.

  time_of_day TIME,
  -- Optional time for the task (stored separately from date)

  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- ─── Completion-based mode fields ───────────────────────────────────
  completion_delay_days INT DEFAULT 1,
  -- Only used when recurrence_mode = 'completion'
  -- Next instance created N days after previous is marked complete

  -- ─── State tracking ─────────────────────────────────────────────────
  is_paused BOOLEAN NOT NULL DEFAULT false,
  paused_at TIMESTAMPTZ,

  next_occurrence DATE,
  -- Pre-computed next date for efficient querying / generation

  last_generated_date DATE,
  -- Last date for which an instance was generated (prevents duplicates)

  generated_count INT NOT NULL DEFAULT 0,
  -- Total instances generated so far (used with max_count)

  -- ─── Timestamps ─────────────────────────────────────────────────────
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Series Exceptions (skipped or rescheduled dates) ───────────────────
CREATE TABLE IF NOT EXISTS pm_series_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES pm_task_series(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('skip', 'reschedule')),
  reschedule_to DATE,
  -- Required when exception_type = 'reschedule'
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(series_id, exception_date)
);

-- ─── Add series columns to pm_tasks ─────────────────────────────────────
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES pm_task_series(id) ON DELETE SET NULL;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS series_occurrence_date DATE;
-- The scheduled date this instance represents in the series

ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS is_exception BOOLEAN DEFAULT false;
-- True if this instance was individually modified (breaks inheritance from series)

ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS original_date DATE;
-- If rescheduled, the original scheduled date

-- ─── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pm_task_series_project ON pm_task_series(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_task_series_next ON pm_task_series(next_occurrence) WHERE NOT is_paused;
CREATE INDEX IF NOT EXISTS idx_pm_task_series_org ON pm_task_series(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_series ON pm_tasks(series_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_occurrence_date ON pm_tasks(series_id, series_occurrence_date);
CREATE INDEX IF NOT EXISTS idx_pm_series_exceptions_series ON pm_series_exceptions(series_id);

-- ─── Prevent duplicate instance generation (unique per series + date) ───
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_tasks_series_date_unique
  ON pm_tasks(series_id, series_occurrence_date)
  WHERE series_id IS NOT NULL AND series_occurrence_date IS NOT NULL;

-- ─── Updated-at trigger for series ──────────────────────────────────────
CREATE OR REPLACE TRIGGER pm_task_series_updated_at
  BEFORE UPDATE ON pm_task_series
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

-- ─── Validation constraint: until_date and max_count are mutually exclusive
ALTER TABLE pm_task_series ADD CONSTRAINT chk_series_end_condition
  CHECK (NOT (until_date IS NOT NULL AND max_count IS NOT NULL));

-- ─── Validation: completion_delay_days required for completion mode ──────
ALTER TABLE pm_task_series ADD CONSTRAINT chk_completion_delay
  CHECK (recurrence_mode != 'completion' OR completion_delay_days IS NOT NULL);
