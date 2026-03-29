-- Migration 050: Add service_line filter to engagement task templates
-- Allows templates to be scoped to specific service lines (e.g. website_build)
-- NULL = applies to all service lines (existing behavior preserved)

ALTER TABLE pm_engagement_task_templates
  ADD COLUMN IF NOT EXISTS service_line TEXT DEFAULT NULL;

-- Seed website_build task templates
INSERT INTO pm_engagement_task_templates
  (trigger_stage, title, description, due_offset_days, nudge_after_days, engagement_type, service_line, sort_order)
VALUES
  -- Qualified: discovery prep
  ('qualified',
   'Run site audit on client website',
   'Use the Site Audit tool to score the existing site across SEO, conversion, AI discoverability, content, and entity authority.',
   1, 1, 'both', 'website_build', 10),

  ('qualified',
   'Review audit results and prepare Pass 1 brief',
   'Analyze audit findings. Prepare the brand/design brief form for the Pass 1 kickoff conversation.',
   2, 1, 'both', 'website_build', 20),

  -- Discovery Complete: foundation pass
  ('discovery_complete',
   'Fill out Pass 1 brand form with client',
   'Walk through the foundation form: business name, tagline, vertical, tone, brand colors, pages, target audience.',
   1, 1, 'both', 'website_build', 10),

  ('discovery_complete',
   'Generate two mockup options (AI)',
   'Use the Generate button in the Web Project tab to produce Option A and Option B mockups.',
   2, 1, 'both', 'website_build', 20),

  ('discovery_complete',
   'Send client review link for mockup selection',
   'Copy the client review link from the Web Project tab and share it with the client.',
   2, 0, 'both', 'website_build', 30),

  -- Closed Won: full workflow
  ('closed_won',
   'Confirm client selected mockup option',
   'Verify the client has selected Option A or B in the review portal before advancing to Pass 2.',
   1, 1, 'both', 'website_build', 10),

  ('closed_won',
   'Collect page-by-page content from client',
   'Share the content form link. Client fills in headlines, body copy, CTAs, and photo preferences for each page.',
   5, 2, 'both', 'website_build', 20),

  ('closed_won',
   'Generate Pass 2 content preview',
   'After content is saved, click Generate in the Content pass to render the full-content preview.',
   7, 1, 'both', 'website_build', 30),

  ('closed_won',
   'AI-apply client feedback and generate Polish pass',
   'Click Apply Feedback & Polish in the Polish pass to apply all unresolved comments and add SEO/schema.',
   10, 1, 'both', 'website_build', 40),

  ('closed_won',
   'Run scoring rubric — must pass before go-live',
   'Run the quality gate in the Polish pass. SEO ≥ 70, Conversion ≥ 70, AI Discoverability ≥ 60, Content ≥ 60.',
   12, 1, 'both', 'website_build', 50),

  ('closed_won',
   'Configure domain DNS and deploy to production',
   'Point the client domain to the hosting environment and deploy the final build.',
   14, 1, 'both', 'website_build', 60),

  ('closed_won',
   'Run post-launch site audit and generate before/after PDF',
   'Run a final audit on the live URL, then use the Go-Live pass to generate the before/after comparison report.',
   15, 1, 'both', 'website_build', 70);
