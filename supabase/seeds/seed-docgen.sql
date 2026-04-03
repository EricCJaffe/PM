-- =============================================================================
-- Seed: Document Generation — SOW document type + 27 intake fields
-- FSA-branded template using Foundation Stone Advisors color palette.
-- Run this in Supabase SQL Editor after applying migration 017.
-- Safe to re-run (uses ON CONFLICT upserts and deletes before re-inserting fields).
-- =============================================================================

-- ─── 1. Upsert SOW Document Type (FSA branded) ─────────────────────────────

INSERT INTO document_types (slug, name, description, category, html_template, css_styles, header_html, footer_html, variables, is_active)
VALUES (
  'sow',
  'Statement of Work',
  'Professional Statement of Work with scope, timeline, pricing, and terms. FSA-branded with AI-assisted content generation.',
  'proposal',

  -- html_template (FSA branded cover + body)
  E'<div class="document">\n'
  -- Cover page
  || E'  <div class="cover-page">\n'
  || E'    <div class="cover-accent"></div>\n'
  || E'    <div class="cover-body">\n'
  || E'      <div class="cover-header-row">\n'
  || E'        <div>\n'
  || E'          <p class="cover-company">Foundation Stone Advisors, LLC</p>\n'
  || E'          <p class="cover-date-line">{{document_date}} &bull; Statement of Work</p>\n'
  || E'        </div>\n'
  || E'        <img src="/FSA_logo_white.png" class="cover-logo" alt="Foundation Stone Advisors">\n'
  || E'      </div>\n'
  || E'      <div class="cover-divider"></div>\n'
  || E'      <h1 class="cover-title">Statement of Work</h1>\n'
  || E'      <p class="cover-subtitle">{{project_name}}</p>\n'
  || E'      <div class="cover-meta">\n'
  || E'        <table class="cover-meta-table">\n'
  || E'          <tr><td class="cml">Prepared For</td><td>{{client_name}}</td></tr>\n'
  || E'          <tr><td class="cml">Contact</td><td>{{client_contact_name}}</td></tr>\n'
  || E'          <tr><td class="cml">Prepared By</td><td>{{prepared_by}}</td></tr>\n'
  || E'          <tr><td class="cml">Date</td><td>{{document_date}}</td></tr>\n'
  || E'          <tr><td class="cml">Valid Until</td><td>{{valid_until}}</td></tr>\n'
  || E'          <tr><td class="cml">Version</td><td>{{version}}</td></tr>\n'
  || E'        </table>\n'
  || E'      </div>\n'
  || E'      <div class="cover-bottom">\n'
  || E'        <p class="cover-tagline">Pouring the Foundation for Your Success</p>\n'
  || E'        <p class="cover-confidential">Confidential &bull; Foundation Stone Advisors, LLC &bull; Orange Park, FL</p>\n'
  || E'      </div>\n'
  || E'    </div>\n'
  || E'  </div>\n\n'
  -- Body sections
  || E'  <div class="body-content">\n'
  || E'    {{#each sections}}\n'
  || E'    <div class="section" id="section-{{section_key}}">\n'
  || E'      <div class="section-divider"></div>\n'
  || E'      <h2>{{title}}</h2>\n'
  || E'      <div class="section-content">{{{content_html}}}</div>\n'
  || E'    </div>\n'
  || E'    {{/each}}\n\n'
  -- Signature block
  || E'    <div class="signature-block">\n'
  || E'      <div class="section-divider"></div>\n'
  || E'      <h2>Authorization</h2>\n'
  || E'      <p class="sig-intro">By signing below, both parties agree to the terms outlined in this Statement of Work.</p>\n'
  || E'      <div class="sig-row">\n'
  || E'        <div class="sig-col">\n'
  || E'          <p class="sig-label">Client</p>\n'
  || E'          <div class="sig-line"></div>\n'
  || E'          <p class="sig-name">{{client_contact_name}}</p>\n'
  || E'          <p class="sig-title">{{client_contact_title}}</p>\n'
  || E'          <p class="sig-date">Date: _______________</p>\n'
  || E'        </div>\n'
  || E'        <div class="sig-col">\n'
  || E'          <p class="sig-label">Foundation Stone Advisors</p>\n'
  || E'          <div class="sig-line"></div>\n'
  || E'          <p class="sig-name">{{prepared_by}}</p>\n'
  || E'          <p class="sig-title">{{provider_title}}</p>\n'
  || E'          <p class="sig-date">Date: _______________</p>\n'
  || E'        </div>\n'
  || E'      </div>\n'
  || E'    </div>\n'
  || E'  </div>\n'
  || E'</div>',

  -- css_styles (FSA brand: NAVY #1B2A4A, SLATE #3D5A80, ACCENT #5B9BD5)
  E'/* ── FSA Brand Colors ── */\n'
  || E':root {\n'
  || E'  --fsa-navy: #1B2A4A;\n'
  || E'  --fsa-slate: #3D5A80;\n'
  || E'  --fsa-accent: #5B9BD5;\n'
  || E'  --fsa-light-bg: #F0F4F8;\n'
  || E'  --fsa-dark-text: #1A1A2E;\n'
  || E'  --fsa-light-text: #6B7280;\n'
  || E'  --fsa-border: #D1D5DB;\n'
  || E'  --fsa-row-alt: #F8FAFC;\n'
  || E'  --fsa-highlight: #E8F0FE;\n'
  || E'  --fsa-green-bg: #F0FDF4;\n'
  || E'  --fsa-warm-bg: #FFFBEB;\n'
  || E'}\n\n'

  || E'/* ── Base ── */\n'
  || E'html, body { margin: 0; padding: 0; }\n'
  || E'.document { font-family: Helvetica, ''Helvetica Neue'', Arial, sans-serif; color: var(--fsa-dark-text); line-height: 1.6; max-width: 850px; margin: 0 auto; }\n\n'

  || E'/* ── Cover Page ── */\n'
  || E'.cover-page { background: var(--fsa-navy); color: #fff; padding: 0; margin: 0; min-height: 100vh; display: flex; flex-direction: column; }\n'
  || E'.cover-accent { height: 6px; background: linear-gradient(90deg, var(--fsa-accent), var(--fsa-slate)); flex-shrink: 0; }\n'
  || E'.cover-body { padding: 48px 48px 48px; flex: 1; display: flex; flex-direction: column; }\n'
  || E'.cover-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }\n'
  || E'.cover-logo { width: 110px; height: auto; opacity: 0.9; flex-shrink: 0; margin-left: 24px; }\n'
  || E'.cover-company { font-size: 14px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--fsa-accent); margin: 0 0 4px 0; }\n'
  || E'.cover-date-line { font-size: 11px; color: rgba(255,255,255,0.65); margin: 0; letter-spacing: 0.3px; }\n'
  || E'.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0; }\n'
  || E'.cover-confidential { font-size: 10px; color: rgba(255,255,255,0.4); margin: 2px 0 0 0; letter-spacing: 0.2px; }\n'
  || E'.cover-bottom { margin-top: auto; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.15); }\n'
  || E'.cover-divider { width: 60px; height: 3px; background: var(--fsa-accent); margin-bottom: 32px; }\n'
  || E'.cover-title { font-size: 36px; font-weight: 700; margin: 0 0 12px 0; color: #fff; }\n'
  || E'.cover-subtitle { font-size: 20px; font-weight: 400; color: rgba(255,255,255,0.85); margin: 0 0 auto 0; }\n'
  || E'.cover-meta { margin-top: 40px; }\n'
  || E'.cover-meta-table { border-collapse: collapse; }\n'
  || E'.cover-meta-table td { padding: 6px 16px 6px 0; font-size: 13px; color: rgba(255,255,255,0.9); border: none; }\n'
  || E'.cover-meta-table .cml { font-weight: 600; color: var(--fsa-accent); width: 130px; }\n\n'

  || E'/* ── Body Content ── */\n'
  || E'.body-content { padding: 32px 8px; counter-reset: section; }\n'
  || E'.section h2::before { counter-increment: section; content: "A" counter(section) ". "; color: var(--fsa-accent); }\n\n'

  || E'/* ── Section Dividers ── */\n'
  || E'.section-divider { height: 3px; background: var(--fsa-navy); margin-bottom: 8px; width: 100%; }\n'
  || E'.section { margin-bottom: 32px; page-break-inside: avoid; }\n'
  || E'.section h2 { font-size: 18px; font-weight: 700; color: var(--fsa-navy); margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 1px solid var(--fsa-border); }\n\n'

  || E'/* ── Section Content ── */\n'
  || E'.section-content { font-size: 14px; color: var(--fsa-dark-text); }\n'
  || E'.section-content p { margin: 0 0 10px 0; }\n'
  || E'.section-content ul, .section-content ol { margin: 8px 0 12px; padding-left: 24px; }\n'
  || E'.section-content li { margin-bottom: 4px; }\n'
  || E'.section-content strong { color: var(--fsa-navy); }\n\n'

  || E'/* ── Tables in Sections ── */\n'
  || E'.section-content table { width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid var(--fsa-border); }\n'
  || E'.section-content table th { background: var(--fsa-light-bg); font-weight: 600; text-align: left; padding: 10px 14px; border: 1px solid var(--fsa-border); color: var(--fsa-navy); font-size: 13px; }\n'
  || E'.section-content table td { padding: 10px 14px; border: 1px solid var(--fsa-border); font-size: 13px; }\n'
  || E'.section-content table tr:nth-child(even) td { background: var(--fsa-row-alt); }\n\n'

  || E'/* ── Callout Boxes ── */\n'
  || E'.callout-blue { background: var(--fsa-highlight); border-left: 4px solid var(--fsa-accent); padding: 12px 16px; margin: 12px 0; border-radius: 0 4px 4px 0; }\n'
  || E'.callout-green { background: var(--fsa-green-bg); border-left: 4px solid #22c55e; padding: 12px 16px; margin: 12px 0; border-radius: 0 4px 4px 0; }\n'
  || E'.callout-warm { background: var(--fsa-warm-bg); border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 12px 0; border-radius: 0 4px 4px 0; }\n\n'

  || E'/* ── Signature Block ── */\n'
  || E'.signature-block { margin-top: 40px; page-break-inside: avoid; }\n'
  || E'.sig-intro { font-size: 13px; color: var(--fsa-light-text); margin-bottom: 32px; }\n'
  || E'.sig-row { display: flex; gap: 48px; }\n'
  || E'.sig-col { flex: 1; }\n'
  || E'.sig-label { font-weight: 700; font-size: 13px; color: var(--fsa-navy); margin-bottom: 48px; }\n'
  || E'.sig-line { border-bottom: 1px solid var(--fsa-navy); margin-bottom: 8px; }\n'
  || E'.sig-name { font-weight: 600; font-size: 13px; margin: 0; color: var(--fsa-dark-text); }\n'
  || E'.sig-title { font-size: 12px; color: var(--fsa-light-text); margin: 2px 0 0 0; }\n'
  || E'.sig-date { font-size: 12px; color: var(--fsa-light-text); margin-top: 8px; }\n\n'

  || E'/* ── Status Badges ── */\n'
  || E'.badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin: 0 2px; }\n'
  || E'.badge-live, .badge-active { background: #16a34a; color: #fff; }\n'
  || E'.badge-connected, .badge-complete, .badge-done { background: #2563eb; color: #fff; }\n'
  || E'.badge-pending, .badge-in-progress { background: #d97706; color: #fff; }\n'
  || E'.badge-review { background: #7c3aed; color: #fff; }\n'
  || E'.badge-planned, .badge-not-started { background: #6b7280; color: #fff; }\n\n'

  || E'/* ── Priority Labels ── */\n'
  || E'.priority-label { display: inline-block; padding: 3px 10px; border-radius: 2px; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }\n'
  || E'.priority-immediate { background: #dc2626; color: #fff; }\n'
  || E'.priority-high { background: #ea580c; color: #fff; }\n'
  || E'.priority-medium { background: #d97706; color: #fff; }\n\n'

  || E'/* ── Print ── */\n'
  || E'@media print {\n'
  || E'  .document { max-width: 100%; }\n'
  || E'  .cover-page { min-height: auto; page-break-after: always; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n'
  || E'  .section { page-break-inside: avoid; }\n'
  || E'  .signature-block { page-break-inside: avoid; }\n'
  || E'}',

  -- header_html (FSA branded page header for body pages)
  E'<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 2px solid #1B2A4A; font-size: 11px; margin-bottom: 16px;">\n'
  || E'  <span style="font-weight: 700; color: #1B2A4A; letter-spacing: 1px; text-transform: uppercase; font-size: 10px;">Foundation Stone Advisors</span>\n'
  || E'  <span style="color: #6B7280; font-style: italic;">{{client_name}} &mdash; Statement of Work</span>\n'
  || E'</div>',

  -- footer_html (FSA branded page footer)
  E'<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 2px solid #1B2A4A; font-size: 10px; color: #6B7280; margin-top: 16px;">\n'
  || E'  <span>Foundation Stone Advisors, LLC &bull; Orange Park, FL &bull; Confidential</span>\n'
  || E'  <span>Page {{page}} of {{pages}}</span>\n'
  || E'</div>',

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
    '["Fixed Price","Time & Materials","Retainer (Monthly)","Monthly Recurring","Milestone-Based","Hybrid"]'::jsonb);

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'total_price', 'Total Price', 'currency', 'Pricing & Payment', 41, false, '50000', 'Format as currency in the pricing table.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'hourly_rate', 'Hourly Rate (if T&M)', 'currency', 'Pricing & Payment', 42, false, '175');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'estimated_hours', 'Estimated Hours (if T&M)', 'number', 'Pricing & Payment', 43, false, '300');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'payment_schedule', 'Payment Schedule', 'textarea', 'Pricing & Payment', 44, false, 'e.g., 50% upfront, 25% at midpoint, 25% on completion...', 'Create a payment schedule table with milestone, amount, and due date columns.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, options, help_text)
  VALUES (_type_id, 'payment_terms', 'Payment Terms', 'select', 'Pricing & Payment', 45, true,
    'Use as the payment terms in the pricing section and Terms & Conditions.',
    '["Due on Receipt","Net 15","Net 30","Net 60","50% Upfront / 50% on Completion","Custom"]'::jsonb,
    'QuickBooks-compatible payment terms. Select "Custom" to specify in notes.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, help_text, placeholder)
  VALUES (_type_id, 'line_items', 'Products & Services', 'textarea', 'Pricing & Payment', 46, false,
    'Parse as JSON array of line items. Group by billing_type: "monthly" items go in Monthly Recurring Costs table, "one-time" items go in One-Time Costs table. Each item has: description, amount, quantity, billing_type.',
    'Add individual product/service line items with billing type (monthly recurring or one-time).', '[]');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'payment_notes', 'Payment Notes', 'textarea', 'Pricing & Payment', 47, false,
    'Additional notes about payment schedule, billing details, or special arrangements...',
    'Include these notes in the payment section of the document.');

  -- ── Terms & Conditions ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, help_text, default_value, placeholder)
  VALUES (_type_id, 'terms_conditions_text', 'Terms & Conditions', 'textarea', 'Terms & Conditions', 70, false,
    'Use this text as the basis for the Terms & Conditions section. Expand into professional legal language while preserving the intent. Include the contract length and cancellation terms specified.',
    'Default language for the agreement terms. Edit as needed for specific engagements.',
    'This is a month-to-month agreement that may be canceled at any time by either party with 30 days written notice. All fees for services rendered through the cancellation date remain due and payable.',
    'Enter terms and conditions for this agreement...');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, options, help_text)
  VALUES (_type_id, 'contract_length', 'Contract Length', 'select', 'Terms & Conditions', 71, false,
    'Reference the contract length in the Terms & Conditions section. If "Month-to-Month", emphasize cancellation flexibility. If annual or multi-year, note the commitment period and any early termination provisions.',
    '["Month-to-Month","3 Months","6 Months","12 Months (Annual)","24 Months","Custom"]'::jsonb,
    'Length of the service agreement. Affects cancellation terms and commitment language.');

  -- ── Provider Details ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, default_value)
  VALUES (_type_id, 'prepared_by', 'Prepared By', 'text', 'Provider Details', 50, true, 'Select team member', '');

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
-- SOW document type seeded with FSA branding + 33 intake fields across 8 sections:
--   Client Information (4), Project Details (3), Scope & Deliverables (4),
--   Timeline (3), Pricing & Payment (9), Terms & Conditions (2),
--   Provider Details (3), Document Settings (4)
