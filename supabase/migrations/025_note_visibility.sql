-- Add visibility column to client notes
-- 'internal' = company-only, 'client' = visible to client
ALTER TABLE pm_client_notes
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal'
  CHECK (visibility IN ('internal', 'client'));
