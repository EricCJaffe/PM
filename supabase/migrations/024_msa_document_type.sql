-- Migration 024: MSA Document Type Template
-- Adds a Master Service Agreement template to the document_types system

INSERT INTO document_types (name, slug, description, category, html_template, css_styles, header_html, footer_html, variables, is_active)
VALUES (
  'Master Service Agreement',
  'msa',
  'Standard Master Service Agreement for client engagements',
  'agreement',
  '<div class="msa-document">
  <h1 style="text-align:center; margin-bottom:2em;">MASTER SERVICE AGREEMENT</h1>

  <p>This Master Service Agreement ("Agreement") is entered into as of <strong>{{effective_date}}</strong> ("Effective Date") by and between:</p>

  <p><strong>Provider:</strong> {{provider_name}}<br/>
  Address: {{provider_address}}<br/>
  Contact: {{provider_contact}}</p>

  <p><strong>Client:</strong> {{client_name}}<br/>
  Address: {{client_address}}<br/>
  Contact: {{client_contact}}</p>

  <h2>1. SERVICES</h2>
  <p>Provider agrees to perform the services described in one or more Statements of Work ("SOW") executed under this Agreement. Each SOW shall be incorporated into and governed by the terms of this Agreement.</p>

  <h2>2. TERM</h2>
  <p>This Agreement shall commence on the Effective Date and continue for an initial term of {{initial_term}} ("Initial Term"), unless terminated earlier in accordance with this Agreement. After the Initial Term, this Agreement shall automatically renew for successive {{renewal_term}} periods unless either party provides written notice of non-renewal at least {{notice_period}} prior to the end of the then-current term.</p>

  <h2>3. COMPENSATION</h2>
  <p>Client shall compensate Provider as set forth in each SOW. Payment terms: {{payment_terms}}.</p>

  <h2>4. CONFIDENTIALITY</h2>
  <p>Each party agrees to maintain the confidentiality of the other party''s proprietary and confidential information. This obligation shall survive termination of this Agreement for a period of {{confidentiality_period}}.</p>

  <h2>5. INTELLECTUAL PROPERTY</h2>
  <p>{{ip_ownership_clause}}</p>

  <h2>6. LIMITATION OF LIABILITY</h2>
  <p>Neither party shall be liable for any indirect, incidental, special, consequential, or punitive damages arising from this Agreement. Provider''s total liability shall not exceed {{liability_cap}}.</p>

  <h2>7. TERMINATION</h2>
  <p>Either party may terminate this Agreement: (a) for convenience with {{termination_notice}} written notice; (b) immediately upon material breach that remains uncured for {{cure_period}} after written notice.</p>

  <h2>8. GOVERNING LAW</h2>
  <p>This Agreement shall be governed by the laws of the State of {{governing_state}}.</p>

  <h2>9. ENTIRE AGREEMENT</h2>
  <p>This Agreement, including all SOWs executed hereunder, constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, and agreements.</p>

  <div style="margin-top:4em;">
  <div style="display:flex; justify-content:space-between;">
    <div style="width:45%;">
      <p><strong>PROVIDER</strong></p>
      <p>{{provider_name}}</p>
      <br/><br/>
      <p>____________________________</p>
      <p>Signature</p>
      <p>Name: {{provider_signer_name}}</p>
      <p>Title: {{provider_signer_title}}</p>
      <p>Date: _______________</p>
    </div>
    <div style="width:45%;">
      <p><strong>CLIENT</strong></p>
      <p>{{client_name}}</p>
      <br/><br/>
      <p>____________________________</p>
      <p>Signature</p>
      <p>Name: {{client_signer_name}}</p>
      <p>Title: {{client_signer_title}}</p>
      <p>Date: _______________</p>
    </div>
  </div>
  </div>
</div>',
  'body { font-family: "Georgia", serif; font-size: 11pt; line-height: 1.6; color: #333; }
h1 { font-size: 18pt; font-weight: bold; }
h2 { font-size: 13pt; margin-top: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
p { margin-bottom: 0.8em; }
.msa-document { max-width: 8.5in; margin: 0 auto; padding: 1in; }',
  '',
  '<div style="text-align:center; font-size:8pt; color:#999; border-top:1px solid #eee; padding-top:0.5em;">
  Confidential — {{provider_name}} & {{client_name}}
</div>',
  '{}',
  true
) ON CONFLICT (slug) DO NOTHING;

-- Add intake fields for the MSA template
-- We need to reference the document_type_id, so use a DO block
DO $$
DECLARE
  dt_id UUID;
BEGIN
  SELECT id INTO dt_id FROM document_types WHERE slug = 'msa' LIMIT 1;
  IF dt_id IS NULL THEN RETURN; END IF;

  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, placeholder, section, sort_order, is_required, ai_hint) VALUES
  (dt_id, 'effective_date', 'Effective Date', 'date', NULL, 'Agreement Details', 1, true, 'The date the MSA takes effect'),
  (dt_id, 'provider_name', 'Provider Name', 'text', 'Foundation Stone Advisors LLC', 'Provider', 2, true, 'Your company legal name'),
  (dt_id, 'provider_address', 'Provider Address', 'textarea', '123 Main St, City, State ZIP', 'Provider', 3, true, NULL),
  (dt_id, 'provider_contact', 'Provider Contact', 'text', 'Name, email, phone', 'Provider', 4, true, NULL),
  (dt_id, 'provider_signer_name', 'Provider Signer Name', 'text', 'Eric Jaffe', 'Provider', 5, true, NULL),
  (dt_id, 'provider_signer_title', 'Provider Signer Title', 'text', 'Managing Consultant', 'Provider', 6, true, NULL),
  (dt_id, 'client_name', 'Client Name', 'text', 'Acme Corp', 'Client', 7, true, 'Client legal entity name'),
  (dt_id, 'client_address', 'Client Address', 'textarea', '456 Oak Ave, City, State ZIP', 'Client', 8, true, NULL),
  (dt_id, 'client_contact', 'Client Contact', 'text', 'Name, email, phone', 'Client', 9, true, NULL),
  (dt_id, 'client_signer_name', 'Client Signer Name', 'text', NULL, 'Client', 10, true, NULL),
  (dt_id, 'client_signer_title', 'Client Signer Title', 'text', NULL, 'Client', 11, true, NULL),
  (dt_id, 'initial_term', 'Initial Term', 'text', '12 months', 'Terms', 12, true, 'Duration of initial agreement period'),
  (dt_id, 'renewal_term', 'Renewal Term', 'text', '12-month', 'Terms', 13, true, 'Duration of each renewal period'),
  (dt_id, 'notice_period', 'Non-Renewal Notice Period', 'text', '30 days', 'Terms', 14, true, NULL),
  (dt_id, 'payment_terms', 'Payment Terms', 'text', 'Net 30 from date of invoice', 'Terms', 15, true, NULL),
  (dt_id, 'confidentiality_period', 'Confidentiality Survival Period', 'text', '2 years', 'Terms', 16, true, NULL),
  (dt_id, 'ip_ownership_clause', 'IP Ownership Clause', 'textarea', 'All work product created by Provider under any SOW shall be considered work-for-hire and shall be the exclusive property of Client upon full payment.', 'Terms', 17, true, 'Intellectual property ownership terms'),
  (dt_id, 'liability_cap', 'Liability Cap', 'text', 'the total fees paid under the applicable SOW', 'Terms', 18, true, NULL),
  (dt_id, 'termination_notice', 'Termination Notice Period', 'text', '30 days', 'Terms', 19, true, NULL),
  (dt_id, 'cure_period', 'Breach Cure Period', 'text', '15 days', 'Terms', 20, true, NULL),
  (dt_id, 'governing_state', 'Governing State', 'text', 'Florida', 'Terms', 21, true, 'State whose laws govern this agreement')
  ON CONFLICT DO NOTHING;
END $$;
