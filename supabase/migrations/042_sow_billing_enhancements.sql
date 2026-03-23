-- =============================================================================
-- Migration 042: SOW Billing Enhancements
-- Adds: payment_notes, payment_terms dropdown, line_items (JSON), terms_conditions text
-- =============================================================================

DO $$
DECLARE
  _type_id UUID;
BEGIN
  SELECT id INTO _type_id FROM document_types WHERE slug = 'sow';
  IF _type_id IS NULL THEN
    RAISE NOTICE 'SOW document type not found — skipping';
    RETURN;
  END IF;

  -- ── Payment Terms dropdown (QuickBooks-compatible) ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, options, help_text)
  VALUES (_type_id, 'payment_terms', 'Payment Terms', 'select', 'Pricing & Payment', 45, true,
    'Use as the payment terms in the pricing section and Terms & Conditions.',
    '["Due on Receipt","Net 15","Net 30","Net 60","50% Upfront / 50% on Completion","Custom"]'::jsonb,
    'QuickBooks-compatible payment terms. Select "Custom" to specify in notes.')
  ON CONFLICT (document_type_id, field_key) DO UPDATE SET
    label = EXCLUDED.label, options = EXCLUDED.options, help_text = EXCLUDED.help_text,
    ai_hint = EXCLUDED.ai_hint, sort_order = EXCLUDED.sort_order;

  -- ── Line Items (JSON stored as textarea, rendered by custom component) ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, help_text, placeholder)
  VALUES (_type_id, 'line_items', 'Products & Services', 'textarea', 'Pricing & Payment', 46, false,
    'Parse as JSON array of line items. Group by billing_type: "monthly" items go in Monthly Recurring Costs table, "one-time" items go in One-Time Costs table. Each item has: description, amount, quantity, billing_type.',
    'Add individual product/service line items with billing type (monthly recurring or one-time).',
    '[]')
  ON CONFLICT (document_type_id, field_key) DO UPDATE SET
    label = EXCLUDED.label, ai_hint = EXCLUDED.ai_hint, help_text = EXCLUDED.help_text,
    placeholder = EXCLUDED.placeholder, sort_order = EXCLUDED.sort_order;

  -- ── Payment Notes ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, placeholder, ai_hint)
  VALUES (_type_id, 'payment_notes', 'Payment Notes', 'textarea', 'Pricing & Payment', 47, false,
    'Additional notes about payment schedule, billing details, or special arrangements...',
    'Include these notes in the payment section of the document.')
  ON CONFLICT (document_type_id, field_key) DO UPDATE SET
    label = EXCLUDED.label, ai_hint = EXCLUDED.ai_hint, placeholder = EXCLUDED.placeholder,
    sort_order = EXCLUDED.sort_order;

  -- ── Terms & Conditions default text ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, help_text, default_value, placeholder)
  VALUES (_type_id, 'terms_conditions_text', 'Terms & Conditions', 'textarea', 'Terms & Conditions', 70, false,
    'Use this text as the basis for the Terms & Conditions section. Expand into professional legal language while preserving the intent. Include the contract length and cancellation terms specified.',
    'Default language for the agreement terms. Edit as needed for specific engagements.',
    'This is a month-to-month agreement that may be canceled at any time by either party with 30 days written notice. All fees for services rendered through the cancellation date remain due and payable.',
    'Enter terms and conditions for this agreement...')
  ON CONFLICT (document_type_id, field_key) DO UPDATE SET
    label = EXCLUDED.label, ai_hint = EXCLUDED.ai_hint, help_text = EXCLUDED.help_text,
    default_value = EXCLUDED.default_value, placeholder = EXCLUDED.placeholder,
    sort_order = EXCLUDED.sort_order;

  -- ── Contract Length ──
  INSERT INTO document_intake_fields (document_type_id, field_key, label, field_type, section, sort_order, is_required, ai_hint, options, help_text)
  VALUES (_type_id, 'contract_length', 'Contract Length', 'select', 'Terms & Conditions', 71, false,
    'Reference the contract length in the Terms & Conditions section. If "Month-to-Month", emphasize cancellation flexibility. If annual or multi-year, note the commitment period and any early termination provisions.',
    '["Month-to-Month","3 Months","6 Months","12 Months (Annual)","24 Months","Custom"]'::jsonb,
    'Length of the service agreement. Affects cancellation terms and commitment language.')
  ON CONFLICT (document_type_id, field_key) DO UPDATE SET
    label = EXCLUDED.label, options = EXCLUDED.options, ai_hint = EXCLUDED.ai_hint,
    help_text = EXCLUDED.help_text, sort_order = EXCLUDED.sort_order;

END $$;
