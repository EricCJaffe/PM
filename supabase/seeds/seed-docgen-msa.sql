-- =============================================================================
-- Seed: Document Generation — MSA (Master Service Agreement)
-- FSA-branded template following the same pattern as SOW and NDA.
-- Run this in Supabase SQL Editor after applying migration 017.
-- Safe to re-run (uses ON CONFLICT upserts and deletes before re-inserting fields).
--
-- This REPLACES the old migration-024 MSA with the standardized template pattern:
--   - FSA branded cover page, header, footer
--   - {{#each sections}} for editable clauses
--   - Standard signature-block div (auto-replaced by DocuSeal at eSign time)
--   - Standard intake field keys for eSign compatibility
-- =============================================================================

-- ─── 1. Upsert MSA Document Type (FSA branded) ─────────────────────────────

INSERT INTO document_types (slug, name, description, category, html_template, css_styles, header_html, footer_html, variables, is_active)
VALUES (
  'msa',
  'Master Service Agreement',
  'Professional Master Service Agreement governing ongoing client engagements. FSA-branded with editable clauses and DocuSeal eSign support.',
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
  || E'          <p class="cover-date-line">{{effective_date}} &bull; Master Service Agreement</p>\n'
  || E'        </div>\n'
  || E'        <img src="/FSA_logo_white.png" class="cover-logo" alt="Foundation Stone Advisors">\n'
  || E'      </div>\n'
  || E'      <div class="cover-divider"></div>\n'
  || E'      <h1 class="cover-title">Master Service Agreement</h1>\n'
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
  || E'        <p>This Master Service Agreement (&ldquo;Agreement&rdquo;) is entered into as of <strong>{{effective_date}}</strong> (&ldquo;Effective Date&rdquo;) by and between:</p>\n'
  || E'        <p><strong>Foundation Stone Advisors, LLC</strong>, a Florida corporation, with its principal place of business at 6175 Bobby Padgett Road, Jacksonville, FL 32234 (&ldquo;<strong>Provider</strong>&rdquo; or &ldquo;<strong>FSA</strong>&rdquo;); and</p>\n'
  || E'        <p><strong>{{client_name}}</strong>, a {{client_entity_type}}, with its principal place of business at {{client_address}} (&ldquo;<strong>Client</strong>&rdquo;).</p>\n'
  || E'        <p>Provider and Client may be referred to individually as a &ldquo;Party&rdquo; and collectively as the &ldquo;Parties.&rdquo;</p>\n'
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
  || E'      <p class="sig-intro">IN WITNESS WHEREOF, the Parties have executed this Master Service Agreement as of the Effective Date.</p>\n'
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

  -- css_styles (same FSA brand as SOW/NDA)
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

  -- header_html
  E'<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 2px solid #1B2A4A; font-size: 11px; margin-bottom: 16px;">\n'
  || E'  <span style="font-weight: 700; color: #1B2A4A; letter-spacing: 1px; text-transform: uppercase; font-size: 10px;">Foundation Stone Advisors</span>\n'
  || E'  <span style="color: #6B7280; font-style: italic;">{{client_name}} &mdash; Master Service Agreement</span>\n'
  || E'</div>',

  -- footer_html
  E'<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 2px solid #1B2A4A; font-size: 10px; color: #6B7280; margin-top: 16px;">\n'
  || E'  <span>Foundation Stone Advisors, LLC &bull; Jacksonville, FL &bull; Confidential</span>\n'
  || E'  <span>Page {{page}} of {{pages}}</span>\n'
  || E'</div>',

  -- variables (9 MSA sections with default clause content)
  '{"sections":[
    {"section_key":"services","title":"1. Services","sort_order":1,"default_content":"<p>Provider agrees to perform the services described in one or more Statements of Work (&ldquo;SOW&rdquo;) executed under this Agreement. Each SOW shall be incorporated into and governed by the terms of this Agreement.</p><p>Each SOW shall describe the scope of services, deliverables, timeline, and fees applicable to the engagement. In the event of a conflict between a SOW and this Agreement, the terms of this Agreement shall control unless the SOW expressly states otherwise.</p>"},
    {"section_key":"term","title":"2. Term and Renewal","sort_order":2,"default_content":"<p>This Agreement shall commence on the Effective Date and continue for an initial term of twelve (12) months (&ldquo;Initial Term&rdquo;), unless terminated earlier in accordance with this Agreement.</p><p>After the Initial Term, this Agreement shall automatically renew for successive twelve (12) month periods unless either Party provides written notice of non-renewal at least thirty (30) days prior to the end of the then-current term.</p>"},
    {"section_key":"compensation","title":"3. Compensation and Payment","sort_order":3,"default_content":"<p>Client shall compensate Provider as set forth in each SOW. Unless otherwise specified in a SOW, invoices are due Net 30 from the date of invoice.</p><p>Late payments shall accrue interest at the rate of 1.5% per month or the maximum rate permitted by law, whichever is less. Client shall reimburse Provider for all reasonable pre-approved expenses incurred in connection with the services.</p>"},
    {"section_key":"confidentiality","title":"4. Confidentiality","sort_order":4,"default_content":"<p>Each Party agrees to maintain the confidentiality of the other Party&rsquo;s proprietary and confidential information disclosed in connection with this Agreement. Confidential information shall be used solely for the purposes of this Agreement and shall not be disclosed to third parties without prior written consent.</p><p>This obligation shall survive termination of this Agreement for a period of two (2) years.</p>"},
    {"section_key":"ip","title":"5. Intellectual Property","sort_order":5,"default_content":"<p>All pre-existing intellectual property of each Party shall remain the property of that Party. Work product created by Provider specifically for Client under a SOW shall be the property of Client upon full payment of all amounts due.</p><p>Provider retains the right to use general knowledge, skills, experience, and any tools, methodologies, or frameworks developed independent of this Agreement.</p>"},
    {"section_key":"liability","title":"6. Limitation of Liability","sort_order":6,"default_content":"<p>NEITHER PARTY SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM THIS AGREEMENT, regardless of the form of action or theory of liability.</p><p>Provider&rsquo;s total aggregate liability under this Agreement shall not exceed the total fees paid by Client under the applicable SOW giving rise to the claim during the twelve (12) months preceding the claim.</p>"},
    {"section_key":"termination","title":"7. Termination","sort_order":7,"default_content":"<p>Either Party may terminate this Agreement: (a) for convenience with thirty (30) days&rsquo; written notice; or (b) immediately upon material breach that remains uncured for fifteen (15) days after written notice.</p><p>Upon termination, Client shall pay Provider for all services rendered and expenses incurred through the effective date of termination. Sections 4, 5, 6, and 8 shall survive termination.</p>"},
    {"section_key":"governing_law","title":"8. Governing Law and Dispute Resolution","sort_order":8,"default_content":"<p>This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of laws provisions.</p><p>Any dispute arising under this Agreement shall be resolved first through good-faith negotiation. If unresolved within thirty (30) days, either Party may pursue resolution in the state or federal courts located in Duval County, Florida.</p>"},
    {"section_key":"general","title":"9. General Provisions","sort_order":9,"default_content":"<p><strong>Entire Agreement.</strong> This Agreement, together with all SOWs executed hereunder, constitutes the entire agreement between the Parties and supersedes all prior negotiations, representations, and agreements relating to the subject matter hereof.</p><p><strong>Amendment.</strong> This Agreement may be amended only by written instrument signed by both Parties.</p><p><strong>Assignment.</strong> Neither Party may assign this Agreement without the prior written consent of the other Party, except in connection with a merger, acquisition, or sale of substantially all assets.</p><p><strong>Counterparts.</strong> This Agreement may be executed in counterparts and via electronic signatures, each of which shall be deemed an original.</p>"}
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


-- ─── 2. Delete existing intake fields for MSA (clean re-seed) ─────────────────

DELETE FROM document_intake_fields
WHERE document_type_id = (SELECT id FROM document_types WHERE slug = 'msa');


-- ─── 3. Insert intake fields ──────────────────────────────────────────────────

DO $$
DECLARE
  _type_id UUID;
BEGIN
  SELECT id INTO _type_id FROM document_types WHERE slug = 'msa';

  -- ── Client Information (eSign-compatible field keys) ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'client_name', 'Client / Company Name', 'text', 'Client Information', 1, true, 'Acme Corporation', 'Use as the client name throughout the agreement.');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_entity_type', 'Entity Type', 'text', 'Client Information', 2, true, 'Delaware limited liability company');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_address', 'Client Address', 'text', 'Client Information', 3, true, '123 Main Street, Suite 200, City, ST 00000');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_name', 'Client Signer Name', 'text', 'Client Information', 4, true, 'Jane Smith');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_title', 'Client Signer Title', 'text', 'Client Information', 5, false, 'CEO');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder)
  VALUES (_type_id, 'client_contact_email', 'Client Signer Email', 'text', 'Client Information', 6, true, 'jane@acme.com');

  -- ── Agreement Details ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required)
  VALUES (_type_id, 'effective_date', 'Effective Date', 'date', 'Agreement Details', 10, true);

  -- ── Provider Details (eSign-compatible) ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, default_value)
  VALUES (_type_id, 'prepared_by', 'FSA Signer Name', 'text', 'Provider Details', 20, true, 'Eric Jaffe', '');

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, default_value)
  VALUES (_type_id, 'provider_title', 'FSA Signer Title', 'text', 'Provider Details', 21, false, 'Principal', 'Principal');

  -- ── Document Settings ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, default_value, placeholder)
  VALUES (_type_id, 'version', 'Version', 'text', 'Document Settings', 30, false, '1.0', '1.0');

END $$;


-- ─── Done ─────────────────────────────────────────────────────────────────────
-- MSA document type seeded with FSA branding + 11 intake fields across 4 sections:
--   Client Information (6), Agreement Details (1),
--   Provider Details (2), Document Settings (1)
-- 9 clause sections with pre-populated default content (all editable before sending).
-- Signature block auto-replaced by injectSignatureFields() at eSign time.
-- Uses standard eSign field keys: client_contact_name, client_contact_email, prepared_by
