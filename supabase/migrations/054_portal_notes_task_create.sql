-- Add show_notes and allow_task_create to pm_portal_settings
ALTER TABLE pm_portal_settings
  ADD COLUMN IF NOT EXISTS show_notes BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_task_create BOOLEAN NOT NULL DEFAULT false;
