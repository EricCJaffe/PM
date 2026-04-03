-- =============================================================================
-- Seed: Document Generation — NDA (Mutual Non-Disclosure Agreement)
-- FSA-branded template using Foundation Stone Advisors color palette.
-- Run this in Supabase SQL Editor after applying migration 017.
-- Safe to re-run (uses ON CONFLICT upserts and deletes before re-inserting fields).
--
-- PATTERN: Any new document template that needs DocuSeal eSign support must:
--   1. Include a <div class="signature-block"> with sig-row/sig-col structure
--   2. Use {{variable}} placeholders for intake data
--   3. Use {{#each sections}}...{{/each}} for editable body sections
--   4. Reuse the FSA CSS variables and classes from the SOW template
--   5. At eSign time, injectSignatureFields() auto-replaces the static block
--      with DocuSeal <signature-field>, <date-field> tags
-- =============================================================================

-- ─── 1. Upsert NDA Document Type (FSA branded) ─────────────────────────────

INSERT INTO document_types (slug, name, description, category, html_template, css_styles, header_html, footer_html, variables, is_active)
VALUES (
  'nda',
  'Non-Disclosure Agreement',
  'Mutual Non-Disclosure Agreement for protecting confidential information exchanged between FSA and a client or counterparty. FSA-branded with editable clauses.',
  'legal',

  -- html_template (FSA branded cover + body)
  E'<div class="document">\n'
  -- Cover page
  || E'  <div class="cover-page">\n'
  || E'    <div class="cover-accent"></div>\n'
  || E'    <div class="cover-body">\n'
  || E'      <div class="cover-header-row">\n'
  || E'        <div>\n'
  || E'          <p class="cover-company">Foundation Stone Advisors, LLC</p>\n'
  || E'          <p class="cover-date-line">{{effective_date}} &bull; Non-Disclosure Agreement</p>\n'
  || E'        </div>\n'
  || E'        <img src="/FSA_logo_white.png" class="cover-logo" alt="Foundation Stone Advisors">\n'
  || E'      </div>\n'
  || E'      <div class="cover-divider"></div>\n'
  || E'      <h1 class="cover-title">Mutual Non-Disclosure Agreement</h1>\n'
  || E'      <p class="cover-subtitle">{{client_name}}</p>\n'
  || E'      <div class="cover-meta">\n'
  || E'        <table class="cover-meta-table">\n'
  || E'          <tr><td class="cml">Between</td><td>Foundation Stone Advisors &amp; {{client_name}}</td></tr>\n'
  || E'          <tr><td class="cml">Effective Date</td><td>{{effective_date}}</td></tr>\n'
  || E'          <tr><td class="cml">Prepared By</td><td>{{prepared_by}}</td></tr>\n'
  || E'          <tr><td class="cml">Version</td><td>{{version}}</td></tr>\n'
  || E'        </table>\n'
  || E'      </div>\n'
  || E'      <div class="cover-bottom">\n'
  || E'        <p class="cover-tagline">Pouring the Foundation for Your Success</p>\n'
  || E'        <p class="cover-confidential">Confidential &bull; Foundation Stone Advisors, LLC &bull; Orange Park, FL</p>\n'
  || E'      </div>\n'
  || E'    </div>\n'
  || E'  </div>\n\n'
  -- Preamble
  || E'  <div class="body-content">\n'
  || E'    <div class="section preamble">\n'
  || E'      <div class="section-divider"></div>\n'
  || E'      <div class="section-content">\n'
  || E'        <p>This Mutual Non-Disclosure Agreement (&ldquo;Agreement&rdquo;) is entered into as of <strong>{{effective_date}}</strong> (&ldquo;Effective Date&rdquo;) by and between:</p>\n'
  || E'        <p><strong>Foundation Stone Advisors</strong>, a Florida corporation, with its principal place of business at 6175 Bobby Padgett Road, Jacksonville, FL 32234 (&ldquo;<strong>FSA</strong>&rdquo;); and</p>\n'
  || E'        <p><strong>{{client_name}}</strong>, a {{client_entity_type}}, with its principal place of business at {{client_address}} (&ldquo;<strong>{{client_short_name}}</strong>&rdquo;).</p>\n'
  || E'        <p>FSA and {{client_short_name}} may be referred to individually as a &ldquo;Party&rdquo; and collectively as the &ldquo;Parties.&rdquo;</p>\n'
  || E'      </div>\n'
  || E'    </div>\n\n'
  -- Body sections (editable clauses)
  || E'    {{#each sections}}\n'
  || E'    <div class="section" id="section-{{section_key}}">\n'
  || E'      <div class="section-divider"></div>\n'
  || E'      <h2>{{title}}</h2>\n'
  || E'      <div class="section-content">{{{content_html}}}</div>\n'
  || E'    </div>\n'
  || E'    {{/each}}\n\n'
  -- Signature block (auto-replaced by injectSignatureFields at eSign time)
  || E'    <div class="signature-block">\n'
  || E'      <div class="section-divider"></div>\n'
  || E'      <h2>Signatures</h2>\n'
  || E'      <p class="sig-intro">IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.</p>\n'
  || E'      <div class="sig-row">\n'
  || E'        <div class="sig-col">\n'
  || E'          <p class="sig-label">Foundation Stone Advisors</p>\n'
  || E'          <div class="sig-line"></div>\n'
  || E'          <p class="sig-name">{{prepared_by}}</p>\n'
  || E'          <p class="sig-title">{{provider_title}}</p>\n'
  || E'          <p class="sig-date">Date: _______________</p>\n'
  || E'        </div>\n'
  || E'        <div class="sig-col">\n'
  || E'          <p class="sig-label">{{client_name}}</p>\n'
  || E'          <div class="sig-line"></div>\n'
  || E'          <p class="sig-name">{{client_contact_name}}</p>\n'
  || E'          <p class="sig-title">{{client_contact_title}}</p>\n'
  || E'          <p class="sig-date">Date: _______________</p>\n'
  || E'        </div>\n'
  || E'      </div>\n'
  || E'    </div>\n'
  || E'  </div>\n'
  || E'</div>',

  -- css_styles (same FSA brand as SOW — shared palette)
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
  || E'.cover-title { font-size: 32px; font-weight: 700; margin: 0 0 12px 0; color: #fff; }\n'
  || E'.cover-subtitle { font-size: 20px; font-weight: 400; color: rgba(255,255,255,0.85); margin: 0 0 auto 0; }\n'
  || E'.cover-meta { margin-top: 40px; }\n'
  || E'.cover-meta-table { border-collapse: collapse; }\n'
  || E'.cover-meta-table td { padding: 6px 16px 6px 0; font-size: 13px; color: rgba(255,255,255,0.9); border: none; }\n'
  || E'.cover-meta-table .cml { font-weight: 600; color: var(--fsa-accent); width: 130px; }\n\n'

  || E'/* ── Body Content ── */\n'
  || E'.body-content { padding: 32px 8px; counter-reset: section; }\n'
  || E'.section:not(.preamble) h2::before { counter-increment: section; content: counter(section) ". "; color: var(--fsa-accent); }\n\n'

  || E'/* ── Preamble ── */\n'
  || E'.preamble { margin-bottom: 8px; }\n'
  || E'.preamble .section-content p { margin: 0 0 12px 0; font-size: 14px; }\n\n'

  || E'/* ── Section Dividers ── */\n'
  || E'.section-divider { height: 3px; background: var(--fsa-navy); margin-bottom: 8px; width: 100%; }\n'
  || E'.section { margin-bottom: 24px; page-break-inside: avoid; }\n'
  || E'.section h2 { font-size: 16px; font-weight: 700; color: var(--fsa-navy); margin: 0 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid var(--fsa-border); }\n\n'

  || E'/* ── Section Content ── */\n'
  || E'.section-content { font-size: 13px; color: var(--fsa-dark-text); }\n'
  || E'.section-content p { margin: 0 0 10px 0; }\n'
  || E'.section-content ul, .section-content ol { margin: 8px 0 12px; padding-left: 24px; }\n'
  || E'.section-content li { margin-bottom: 4px; }\n'
  || E'.section-content strong { color: var(--fsa-navy); }\n\n'

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
  || E'  <span style="color: #6B7280; font-style: italic;">{{client_name}} &mdash; Mutual NDA</span>\n'
  || E'</div>',

  -- footer_html (FSA branded page footer)
  E'<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 2px solid #1B2A4A; font-size: 10px; color: #6B7280; margin-top: 16px;">\n'
  || E'  <span>Foundation Stone Advisors, LLC &bull; Jacksonville, FL &bull; Confidential</span>\n'
  || E'  <span>Page {{page}} of {{pages}}</span>\n'
  || E'</div>',

  -- variables (default sections with pre-populated clause content — editable before sending)
  '{"sections":[
    {"section_key":"purpose","title":"1. Purpose","sort_order":1,"default_content":"<p>The Parties may exchange non-public information for the purpose of evaluating or carrying out a potential business relationship, including advisory, operational, technical, financial, or strategic activities (the &ldquo;Purpose&rdquo;).</p>"},
    {"section_key":"confidential_information","title":"2. Confidential Information","sort_order":2,"default_content":"<p>&ldquo;Confidential Information&rdquo; means any non-public information disclosed by a Party to the other Party, whether oral, written, electronic, or visual, that reasonably should be understood to be confidential.</p><p>This includes, without limitation: business and financial strategies; budgets and forecasts; documents and internal materials; source code, software designs, and technical documentation; processes and workflows for artificial intelligence or automation implementation; and other proprietary or sensitive information.</p>"},
    {"section_key":"exclusions","title":"3. Exclusions","sort_order":3,"default_content":"<p>Confidential Information does not include information that the Receiving Party can show: (a) is public through no breach of this Agreement; (b) was already known before disclosure; (c) was lawfully received from a third party; or (d) was independently developed without use of the Confidential Information.</p>"},
    {"section_key":"obligations","title":"4. Confidentiality Obligations","sort_order":4,"default_content":"<p>The Receiving Party shall: (a) use Confidential Information only for the Purpose; (b) protect it using reasonable care; and (c) not disclose it to any third party except as permitted under this Agreement.</p>"},
    {"section_key":"representatives","title":"5. Representatives","sort_order":5,"default_content":"<p>Disclosure is permitted only to employees, contractors, or advisors who need to know for the Purpose and are bound by confidentiality obligations at least as protective as this Agreement. The Receiving Party is responsible for their compliance.</p>"},
    {"section_key":"compelled_disclosure","title":"6. Compelled Disclosure","sort_order":6,"default_content":"<p>If disclosure is required by law, the Receiving Party shall provide notice where legally permitted and disclose only what is required.</p>"},
    {"section_key":"ownership","title":"7. Ownership","sort_order":7,"default_content":"<p>All Confidential Information remains the property of the Disclosing Party. No license or other rights are granted except as expressly stated.</p>"},
    {"section_key":"return_destruction","title":"8. Return or Destruction","sort_order":8,"default_content":"<p>Upon written request, Confidential Information shall be returned or destroyed, except for limited archival copies kept for legal or compliance purposes.</p>"},
    {"section_key":"term_survival","title":"9. Term and Survival","sort_order":9,"default_content":"<p>This Agreement is effective for two (2) years from the Effective Date. Confidentiality obligations survive for two (2) years from the date of each disclosure.</p>"},
    {"section_key":"no_obligation","title":"10. No Obligation","sort_order":10,"default_content":"<p>This Agreement does not obligate either Party to enter into any further agreement or transaction.</p>"},
    {"section_key":"remedies","title":"11. Remedies","sort_order":11,"default_content":"<p>Unauthorized use or disclosure may cause irreparable harm. The Disclosing Party may seek injunctive or equitable relief in addition to other remedies.</p>"},
    {"section_key":"governing_law","title":"12. Governing Law and Venue","sort_order":12,"default_content":"<p>This Agreement is governed by the laws of the State of Florida. Venue shall lie exclusively in the state or federal courts located in Duval County, Florida.</p>"},
    {"section_key":"entire_agreement","title":"13. Entire Agreement","sort_order":13,"default_content":"<p>This Agreement is the entire agreement regarding confidentiality and may be amended only in writing signed by both Parties.</p>"},
    {"section_key":"counterparts","title":"14. Counterparts and Electronic Signatures","sort_order":14,"default_content":"<p>This Agreement may be executed in counterparts and via electronic signatures.</p>"}
  ]}'::jsonb,
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


-- ─── 2. Delete existing intake fields for NDA (clean re-seed) ─────────────────

DELETE FROM document_intake_fields
WHERE document_type_id = (SELECT id FROM document_types WHERE slug = 'nda');


-- ─── 3. Insert intake fields ──────────────────────────────────────────────────

DO $$
DECLARE
  _type_id UUID;
BEGIN
  SELECT id INTO _type_id FROM document_types WHERE slug = 'nda';

  -- ── Client / Counterparty Information ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'client_name', 'Client / Counterparty Name', 'text', 'Counterparty Information', 1, true, 'Acme Corporation', 'Use as the counterparty name throughout the agreement.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, help_text)
  VALUES (_type_id, 'client_short_name', 'Short Name', 'text', 'Counterparty Information', 2, true, 'Acme', 'Abbreviation used after first reference (e.g. "Acme" instead of "Acme Corporation").');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_entity_type', 'Entity Type', 'text', 'Counterparty Information', 3, true, 'Delaware limited liability company');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_address', 'Client Address', 'text', 'Counterparty Information', 4, true, '123 Main Street, Suite 200, City, ST 00000');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_name', 'Signer Name', 'text', 'Counterparty Information', 5, true, 'Jane Smith');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_title', 'Signer Title', 'text', 'Counterparty Information', 6, false, 'CEO');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_email', 'Signer Email', 'text', 'Counterparty Information', 7, true, 'jane@acme.com');

  -- ── Agreement Details ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required)
  VALUES (_type_id, 'effective_date', 'Effective Date', 'date', 'Agreement Details', 10, true);

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, default_value, help_text)
  VALUES (_type_id, 'term_years', 'Agreement Term (years)', 'text', 'Agreement Details', 11, false, '2', 'How long the agreement is in effect. Default: 2 years.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, default_value, help_text)
  VALUES (_type_id, 'survival_years', 'Survival Period (years)', 'text', 'Agreement Details', 12, false, '2', 'How long confidentiality obligations survive after each disclosure.');

  -- ── Provider Details ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, default_value)
  VALUES (_type_id, 'prepared_by', 'FSA Signer Name', 'text', 'Provider Details', 20, true, 'Eric Jaffe', '');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, default_value)
  VALUES (_type_id, 'provider_title', 'FSA Signer Title', 'text', 'Provider Details', 21, false, 'Principal', 'Principal');

  -- ── Document Settings ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, default_value, placeholder)
  VALUES (_type_id, 'version', 'Version', 'text', 'Document Settings', 30, false, '1.0', '1.0');

END $$;


-- ─── Done ─────────────────────────────────────────────────────────────────────
-- NDA document type seeded with FSA branding + 13 intake fields across 4 sections:
--   Counterparty Information (7), Agreement Details (3),
--   Provider Details (2), Document Settings (1)
-- 14 clause sections with pre-populated default content (all editable before sending).
-- Signature block auto-replaced by injectSignatureFields() at eSign time.
