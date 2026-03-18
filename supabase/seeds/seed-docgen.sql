-- =============================================================================
-- Seed: Document Generation — SOW document type + 27 intake fields
-- Run this in Supabase SQL Editor after applying migration 017.
-- Safe to re-run (uses ON CONFLICT upserts and deletes before re-inserting fields).
-- =============================================================================

-- ─── 1. Upsert SOW Document Type ──────────────────────────────────────────────

INSERT INTO document_types (slug, name, description, category, html_template, css_styles, header_html, footer_html, variables, is_active)
VALUES (
  'sow',
  'Statement of Work',
  'Professional Statement of Work with scope, timeline, pricing, and terms. Supports AI-assisted content generation.',
  'proposal',
  -- html_template
  E'<div class="document">\n  <div class="header-block">\n    <h1>Statement of Work</h1>\n    <p class="subtitle">{{project_name}}</p>\n  </div>\n\n  <table class="meta-table">\n    <tr><td class="label">Client</td><td>{{client_name}}</td></tr>\n    <tr><td class="label">Prepared For</td><td>{{client_contact_name}}{{#if client_contact_title}}, {{client_contact_title}}{{/if}}</td></tr>\n    <tr><td class="label">Prepared By</td><td>{{prepared_by}}</td></tr>\n    <tr><td class="label">Date</td><td>{{document_date}}</td></tr>\n    <tr><td class="label">Valid Until</td><td>{{valid_until}}</td></tr>\n    <tr><td class="label">Version</td><td>{{version}}</td></tr>\n  </table>\n\n  {{#each sections}}\n  <div class="section" id="section-{{section_key}}">\n    <h2>{{title}}</h2>\n    <div class="section-content">{{{content_html}}}</div>\n  </div>\n  {{/each}}\n\n  <div class="signature-block">\n    <div class="sig-row">\n      <div class="sig-col">\n        <p class="sig-label">Client Signature</p>\n        <div class="sig-line"></div>\n        <p class="sig-name">{{client_contact_name}}</p>\n        <p class="sig-title">{{client_contact_title}}</p>\n        <p class="sig-date">Date: _______________</p>\n      </div>\n      <div class="sig-col">\n        <p class="sig-label">Provider Signature</p>\n        <div class="sig-line"></div>\n        <p class="sig-name">{{prepared_by}}</p>\n        <p class="sig-title">{{provider_title}}</p>\n        <p class="sig-date">Date: _______________</p>\n      </div>\n    </div>\n  </div>\n</div>',
  -- css_styles
  E'.document { font-family: ''Inter'', ''Helvetica Neue'', Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; }\n.header-block { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #3b82f6; padding-bottom: 24px; }\n.header-block h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a; }\n.header-block .subtitle { font-size: 18px; color: #64748b; margin: 0; }\n.meta-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }\n.meta-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }\n.meta-table .label { font-weight: 600; color: #475569; width: 160px; }\n.section { margin-bottom: 28px; }\n.section h2 { font-size: 18px; font-weight: 600; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }\n.section-content { font-size: 14px; }\n.section-content p { margin: 0 0 8px 0; }\n.section-content ul, .section-content ol { margin: 8px 0; padding-left: 24px; }\n.section-content li { margin-bottom: 4px; }\n.section-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }\n.section-content table th { background: #f1f5f9; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; }\n.section-content table td { padding: 8px 12px; border: 1px solid #e2e8f0; }\n.signature-block { margin-top: 48px; page-break-inside: avoid; }\n.sig-row { display: flex; gap: 48px; }\n.sig-col { flex: 1; }\n.sig-label { font-weight: 600; font-size: 14px; margin-bottom: 40px; }\n.sig-line { border-bottom: 1px solid #1e293b; margin-bottom: 8px; }\n.sig-name { font-weight: 600; font-size: 14px; margin: 0; }\n.sig-title { font-size: 13px; color: #64748b; margin: 0; }\n.sig-date { font-size: 13px; color: #64748b; margin-top: 8px; }\n@media print { .document { max-width: 100%; } .section { page-break-inside: avoid; } }',
  -- header_html
  E'<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">\n  <span>{{client_name}} — Statement of Work</span>\n  <span>Confidential</span>\n</div>',
  -- footer_html
  E'<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">\n  <span>Foundation Stone Advisors</span>\n  <span>Page {{page}} of {{pages}}</span>\n</div>',
  -- variables (default sections)
  '{"sections":[{"section_key":"executive_summary","title":"Executive Summary","sort_order":1},{"section_key":"project_overview","title":"Project Overview","sort_order":2},{"section_key":"scope_of_work","title":"Scope of Work","sort_order":3},{"section_key":"deliverables","title":"Deliverables","sort_order":4},{"section_key":"timeline","title":"Timeline & Milestones","sort_order":5},{"section_key":"pricing","title":"Pricing & Payment Terms","sort_order":6},{"section_key":"assumptions","title":"Assumptions & Dependencies","sort_order":7},{"section_key":"acceptance_criteria","title":"Acceptance Criteria","sort_order":8},{"section_key":"change_management","title":"Change Management","sort_order":9},{"section_key":"terms_conditions","title":"Terms & Conditions","sort_order":10}]}'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name            = EXCLUDED.name,
  description     = EXCLUDED.description,
  category        = EXCLUDED.category,
  html_template   = EXCLUDED.html_template,
  css_styles      = EXCLUDED.css_styles,
  header_html     = EXCLUDED.header_html,
  footer_html     = EXCLUDED.footer_html,
  variables       = EXCLUDED.variables,
  is_active       = EXCLUDED.is_active;


-- ─── 2. Delete existing intake fields for SOW (clean re-seed) ─────────────────

DELETE FROM document_intake_fields
WHERE document_type_id = (SELECT id FROM document_types WHERE slug = 'sow');


-- ─── 3. Insert all 27 intake fields ──────────────────────────────────────────

-- Helper: grab the SOW type ID once
DO $$
DECLARE
  _type_id UUID;
BEGIN
  SELECT id INTO _type_id FROM document_types WHERE slug = 'sow';

  -- ── Client Information ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'client_name', 'Client / Company Name', 'text', 'Client Information', 1, true, 'Acme Corporation', 'Use as the client name throughout the document.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_name', 'Client Contact Name', 'text', 'Client Information', 2, true, 'Jane Smith');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_title', 'Client Contact Title', 'text', 'Client Information', 3, false, 'VP of Engineering');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_email', 'Client Contact Email', 'text', 'Client Information', 4, false, 'jane@acme.com');

  -- ── Project Details ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'project_name', 'Project Name', 'text', 'Project Details', 10, true, 'Website Redesign & CRM Integration', 'Use as the project title in the header and throughout.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'project_description', 'Project Description', 'textarea', 'Project Details', 11, true, 'Brief overview of what the project aims to accomplish...', 'Expand this into a professional executive summary and project overview section.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint, options)
  VALUES (_type_id, 'project_type', 'Project Type', 'select', 'Project Details', 12, true, NULL, 'Use to set the tone and terminology of the SOW.',
    '["Software Development","Consulting","Design & Creative","Implementation & Integration","Managed Services","Training & Enablement","Strategy & Advisory","Other"]'::jsonb);

  -- ── Scope & Deliverables ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'in_scope', 'In-Scope Items', 'textarea', 'Scope & Deliverables', 20, true, 'List key deliverables and work items included in this engagement...', 'Format as a professional bulleted list of deliverables in the Scope section.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'out_of_scope', 'Out-of-Scope Items', 'textarea', 'Scope & Deliverables', 21, false, 'List items explicitly excluded from this engagement...', 'Format as exclusions in the Scope section to set clear boundaries.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'deliverables', 'Key Deliverables', 'textarea', 'Scope & Deliverables', 22, false, 'List specific deliverable artifacts (reports, code, designs, etc.)...', 'Create a numbered deliverables table with description and acceptance criteria.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'assumptions', 'Assumptions', 'textarea', 'Scope & Deliverables', 23, false, 'List key assumptions this SOW is based on...', 'Format as a bulleted assumptions list. Add standard assumptions if few are provided.');

  -- ── Timeline ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required)
  VALUES (_type_id, 'start_date', 'Estimated Start Date', 'date', 'Timeline', 30, true);

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required)
  VALUES (_type_id, 'end_date', 'Estimated End Date', 'date', 'Timeline', 31, true);

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'milestones', 'Key Milestones', 'textarea', 'Timeline', 32, false, 'List major milestones with target dates...', 'Create a milestone table with name, target date, and description columns.');

  -- ── Pricing & Payment ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, options)
  VALUES (_type_id, 'pricing_model', 'Pricing Model', 'select', 'Pricing & Payment', 40, true, 'Use to determine the pricing section structure and payment terms.',
    '["Fixed Price","Time & Materials","Retainer (Monthly)","Milestone-Based","Hybrid"]'::jsonb);

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'total_price', 'Total Price', 'currency', 'Pricing & Payment', 41, false, '50000', 'Format as currency in the pricing table.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'hourly_rate', 'Hourly Rate (if T&M)', 'currency', 'Pricing & Payment', 42, false, '175');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'estimated_hours', 'Estimated Hours (if T&M)', 'number', 'Pricing & Payment', 43, false, '300');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'payment_schedule', 'Payment Schedule', 'textarea', 'Pricing & Payment', 44, false, 'e.g., 50% upfront, 25% at midpoint, 25% on completion...', 'Create a payment schedule table with milestone, amount, and due date columns.');

  -- ── Provider Details ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, default_value)
  VALUES (_type_id, 'prepared_by', 'Prepared By', 'text', 'Provider Details', 50, true, 'John Doe', '');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'provider_title', 'Provider Title', 'text', 'Provider Details', 51, false, 'Managing Consultant');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, default_value)
  VALUES (_type_id, 'provider_company', 'Provider Company', 'text', 'Provider Details', 52, false, 'Foundation Stone Advisors', 'Foundation Stone Advisors');

  -- ── Document Settings ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required)
  VALUES (_type_id, 'document_date', 'Document Date', 'date', 'Document Settings', 60, true);

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, help_text)
  VALUES (_type_id, 'valid_until', 'Valid Until', 'date', 'Document Settings', 61, false, 'Date this proposal expires. Defaults to 30 days from document date.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, default_value, placeholder)
  VALUES (_type_id, 'version', 'Version', 'text', 'Document Settings', 62, false, '1.0', '1.0');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, default_value, help_text)
  VALUES (_type_id, 'confidentiality', 'Confidentiality Notice', 'toggle', 'Document Settings', 63, false, 'true', 'Include a confidentiality notice in the document footer.');

END $$;

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- SOW document type seeded with 27 intake fields across 7 sections:
--   Client Information (4), Project Details (3), Scope & Deliverables (4),
--   Timeline (3), Pricing & Payment (5), Provider Details (3),
--   Document Settings (4)
