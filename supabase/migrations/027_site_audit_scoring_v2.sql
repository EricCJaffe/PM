-- =============================================================================
-- Migration 027: Site Audit Scoring v2
-- Adds new JSONB columns for rubric-based numeric scoring, rebuild data,
-- and platform comparison. Existing JSONB columns (scores, gaps, quick_wins,
-- etc.) remain but now store richer structures.
-- =============================================================================

-- Overall score object (grade + numeric score + rebuild logic)
ALTER TABLE pm_site_audits
  ADD COLUMN IF NOT EXISTS overall JSONB;

-- Pages found and missing (string arrays from content dimension)
ALTER TABLE pm_site_audits
  ADD COLUMN IF NOT EXISTS pages_missing JSONB;

-- Rebuild planning data
ALTER TABLE pm_site_audits
  ADD COLUMN IF NOT EXISTS rebuild_timeline JSONB;

ALTER TABLE pm_site_audits
  ADD COLUMN IF NOT EXISTS platform_comparison JSONB;

-- Comment: scores column now stores AuditDimensionScore objects
--   { seo: { grade: "D", score: 62, weight: 0.20, findings: [...] }, ... }
-- instead of simple letter grades { seo: "D", ... }
-- Both formats are handled by the UI for backward compatibility.

-- Comment: gaps column now stores gap tables
--   { seo: [{ item, current_state, standard, gap }], ... }
-- instead of { seo: [{ issue, severity, recommendation }] }

-- Comment: quick_wins now stores { action, time_estimate, impact }
-- instead of { title, description }

-- Comment: pages_to_build now stores { slug, title, priority, notes }
-- instead of { slug, title, reason }
