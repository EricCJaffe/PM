-- Migration 038: Centralized Branding System
-- Platform-level branding + per-org co-branding overrides

-- ─── Platform Branding (singleton row) ────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_platform_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Foundation Stone Advisors',
  company_short_name TEXT NOT NULL DEFAULT 'FSA',
  tagline TEXT DEFAULT 'Pouring the Foundation for Your Success',
  logo_url TEXT,                        -- URL or storage path to primary logo
  logo_icon_url TEXT,                   -- Square icon variant
  favicon_url TEXT,                     -- Favicon
  primary_color TEXT NOT NULL DEFAULT '#1B2A4A',    -- Navy
  secondary_color TEXT NOT NULL DEFAULT '#5B9BD5',  -- Blue accent
  accent_color TEXT NOT NULL DEFAULT '#c4793a',     -- Gold/amber accent
  text_on_primary TEXT NOT NULL DEFAULT '#ffffff',
  text_on_light TEXT NOT NULL DEFAULT '#1a1a1a',
  bg_dark TEXT NOT NULL DEFAULT '#1c2b1e',          -- Dark bg for PDFs/covers
  bg_light TEXT NOT NULL DEFAULT '#f5f0e8',         -- Light bg for content pages
  font_heading TEXT NOT NULL DEFAULT 'Helvetica',
  font_body TEXT NOT NULL DEFAULT 'Helvetica',
  email_from_name TEXT NOT NULL DEFAULT 'BusinessOS PM',
  email_from_address TEXT NOT NULL DEFAULT 'admin@foundationstoneadvisors.com',
  website_url TEXT DEFAULT 'https://pm.foundationstoneadvisors.com',
  support_email TEXT,
  footer_text TEXT DEFAULT 'Foundation Stone Advisors — Project Management',
  location TEXT DEFAULT 'Orange Park, FL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only one row ever exists
CREATE UNIQUE INDEX IF NOT EXISTS pm_platform_branding_singleton ON pm_platform_branding ((true));

-- ─── Per-Org Branding Overrides (co-branding) ────────────────────────
CREATE TABLE IF NOT EXISTS pm_org_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  -- Client branding
  client_logo_url TEXT,                 -- Client logo for co-branded docs
  client_logo_icon_url TEXT,            -- Client square icon
  client_company_name TEXT,             -- Override display name
  -- Color overrides (null = inherit from platform)
  primary_color_override TEXT,
  secondary_color_override TEXT,
  accent_color_override TEXT,
  -- Co-branding mode
  co_brand_mode TEXT NOT NULL DEFAULT 'agency-only'
    CHECK (co_brand_mode IN ('agency-only', 'co-branded', 'client-only', 'white-label')),
  -- PDF/document overrides
  cover_bg_override TEXT,               -- Dark cover background
  content_bg_override TEXT,             -- Light content background
  footer_text_override TEXT,            -- Custom footer for this client
  -- Custom email from (null = inherit)
  email_from_name_override TEXT,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE pm_platform_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_org_branding ENABLE ROW LEVEL SECURITY;

-- Platform branding: internal users read, admin-only write
CREATE POLICY "platform_branding_read" ON pm_platform_branding
  FOR SELECT USING (pm_is_internal());

CREATE POLICY "platform_branding_write" ON pm_platform_branding
  FOR ALL USING (pm_is_internal_write());

-- Org branding: internal users read all, org-scoped read for external
CREATE POLICY "org_branding_internal_read" ON pm_org_branding
  FOR SELECT USING (pm_is_internal());

CREATE POLICY "org_branding_internal_write" ON pm_org_branding
  FOR ALL USING (pm_is_internal_write());

CREATE POLICY "org_branding_external_read" ON pm_org_branding
  FOR SELECT USING (pm_has_org_access(org_id));

-- ─── Seed default platform branding row ──────────────────────────────
INSERT INTO pm_platform_branding (company_name) VALUES ('Foundation Stone Advisors')
ON CONFLICT DO NOTHING;
