-- 011: Personal projects flag + email notification preferences

-- Add is_personal flag to projects (personal projects hidden from main list)
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS is_personal boolean DEFAULT false;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS personal_member_slug text DEFAULT null;

-- Add notify_email flag to tasks (opt-in email notification on assignment)
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS notify_assignee boolean DEFAULT false;

-- Index for filtering personal projects
CREATE INDEX IF NOT EXISTS idx_pm_projects_is_personal ON pm_projects(is_personal);
