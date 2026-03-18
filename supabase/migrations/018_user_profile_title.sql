-- Add job_title and phone to user profiles for document generation and profile display
ALTER TABLE pm_user_profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
