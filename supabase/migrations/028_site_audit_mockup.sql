-- =============================================================================
-- Migration 028: Site Audit Mockup + Subpage Content
-- Adds mockup_html column for storing the rebuilt site design concept,
-- and subpages_content for multi-page fetch context used during scoring.
-- =============================================================================

ALTER TABLE pm_site_audits
  ADD COLUMN IF NOT EXISTS mockup_html TEXT;

ALTER TABLE pm_site_audits
  ADD COLUMN IF NOT EXISTS subpages_fetched JSONB;
  -- Stores [{ pathname, title, wordCount }] for audit transparency
