-- Migration 048: Register website-build project template
-- This seeds the pm_project_templates table with the 5-pass website build template.
-- Safe to run multiple times (upsert on slug).

INSERT INTO pm_project_templates (slug, name, description, phases)
VALUES (
  'website-build',
  'Website Build (5-Pass)',
  'Guided 5-pass website build: Discovery → Foundation & Look → Content → Polish & QA → Go-Live. Includes structured client review gates at each pass.',
  '[
    {
      "order": 1,
      "slug": "wb-discovery",
      "name": "Discovery",
      "group": "WEBSITE",
      "tasks": [
        {"slug": "wb-run-site-audit",           "name": "Run site audit on existing site"},
        {"slug": "wb-review-audit-results",      "name": "Review audit results with team"},
        {"slug": "wb-discuss-findings-client",   "name": "Present findings to client"},
        {"slug": "wb-fill-pass1-form",           "name": "Fill out Pass 1 brand form with client"}
      ]
    },
    {
      "order": 2,
      "slug": "wb-foundation",
      "name": "Pass 1 — Foundation & Look",
      "group": "WEBSITE",
      "tasks": [
        {"slug": "wb-generate-mockups",          "name": "Generate two mockup options (AI)"},
        {"slug": "wb-send-mockup-review",        "name": "Send client review link"},
        {"slug": "wb-collect-mockup-feedback",   "name": "Collect client mockup selection & feedback"},
        {"slug": "wb-approve-pass1",             "name": "Team review & approve Pass 1"}
      ]
    },
    {
      "order": 3,
      "slug": "wb-content",
      "name": "Pass 2 — Content Population",
      "group": "WEBSITE",
      "tasks": [
        {"slug": "wb-send-content-form",         "name": "Send content form to client"},
        {"slug": "wb-collect-content",           "name": "Collect and review client content"},
        {"slug": "wb-generate-ai-content",       "name": "Generate AI copy for missing sections"},
        {"slug": "wb-render-content-preview",    "name": "Render content preview for review"},
        {"slug": "wb-client-content-review",     "name": "Client reviews content pass"},
        {"slug": "wb-approve-pass2",             "name": "Team approve Pass 2"}
      ]
    },
    {
      "order": 4,
      "slug": "wb-polish",
      "name": "Pass 3 — Polish & QA",
      "group": "WEBSITE",
      "tasks": [
        {"slug": "wb-ai-apply-comments",         "name": "AI-apply client feedback comments"},
        {"slug": "wb-human-review-ai-changes",   "name": "Human review of AI-applied changes"},
        {"slug": "wb-wire-seo-schema",           "name": "Wire SEO meta tags, schema.org, llms.txt"},
        {"slug": "wb-mobile-qa",                 "name": "Mobile & cross-browser QA"},
        {"slug": "wb-run-scoring-rubric",        "name": "Run scoring rubric (SEO >= 70, Conversion >= 70)"},
        {"slug": "wb-client-final-review",       "name": "Client final review & approval"}
      ]
    },
    {
      "order": 5,
      "slug": "wb-go-live",
      "name": "Go-Live",
      "group": "WEBSITE",
      "tasks": [
        {"slug": "wb-configure-domain-dns",      "name": "Configure domain & DNS"},
        {"slug": "wb-deploy-to-production",      "name": "Deploy to production"},
        {"slug": "wb-verify-analytics",          "name": "Verify analytics & tracking"},
        {"slug": "wb-test-contact-forms",        "name": "Test all contact forms"},
        {"slug": "wb-run-final-audit",           "name": "Run post-launch site audit"},
        {"slug": "wb-generate-before-after-pdf", "name": "Generate before/after comparison PDF"},
        {"slug": "wb-mark-complete",             "name": "Mark project complete & notify client"}
      ]
    }
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      phases      = EXCLUDED.phases;
