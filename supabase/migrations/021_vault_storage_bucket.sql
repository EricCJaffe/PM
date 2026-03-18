-- Create the 'vault' storage bucket.
-- Used by: document uploads, task attachments, note attachments,
-- vault markdown files, SOP scanning, and GitHub export.
-- All access goes through API routes using the service role client,
-- which bypasses RLS — no storage policies needed.

INSERT INTO storage.buckets (id, name, public)
VALUES ('vault', 'vault', false)
ON CONFLICT (id) DO NOTHING;
