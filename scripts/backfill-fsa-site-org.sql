-- Backfill: Foundation Stone Advisors (FSA) as site-level org
-- Run AFTER applying migration 008_site_org_flag.sql
--
-- This script is idempotent — safe to run multiple times.
-- No FK constraints need disabling; pm_members.org_id → pm_organizations.id
-- and we insert the org first.

-- 1. Insert FSA org (skip if already exists)
INSERT INTO pm_organizations (slug, name, is_site_org)
VALUES ('foundation-stone-advisors', 'Foundation Stone Advisors', true)
ON CONFLICT (slug) DO UPDATE SET is_site_org = true;

-- 2. Add Eric Jaffe as owner member of FSA
-- (uses a subquery to get the org_id)
INSERT INTO pm_members (org_id, slug, display_name, email, role)
SELECT id, 'eric-jaffe', 'Eric Jaffe', 'ejaffe@foundationstoneadvisors.com', 'owner'
FROM pm_organizations
WHERE slug = 'foundation-stone-advisors'
ON CONFLICT (org_id, slug) DO NOTHING;

-- Verify
SELECT
  o.name AS org_name,
  o.is_site_org,
  m.display_name,
  m.slug AS member_slug,
  m.role
FROM pm_organizations o
LEFT JOIN pm_members m ON m.org_id = o.id
WHERE o.slug = 'foundation-stone-advisors';
