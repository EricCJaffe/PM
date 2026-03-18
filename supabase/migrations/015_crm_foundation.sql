-- Migration 015: CRM Foundation
-- Adds pipeline status to organizations, proposals system, and client notes

-- ─── Pipeline Status on Organizations ────────────────────────────────

ALTER TABLE pm_organizations
  ADD COLUMN IF NOT EXISTS pipeline_status TEXT NOT NULL DEFAULT 'lead'
    CHECK (pipeline_status IN ('lead', 'prospect', 'proposal_sent', 'negotiation', 'client', 'inactive')),
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- ─── Proposal Templates ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_proposal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  boilerplate TEXT,
  variable_fields JSONB DEFAULT '[]'::jsonb,
  output_format TEXT NOT NULL DEFAULT 'markdown' CHECK (output_format IN ('html', 'markdown')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Proposals ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  template_slug TEXT REFERENCES pm_proposal_templates(slug),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  form_data JSONB DEFAULT '{}'::jsonb,
  generated_content TEXT,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Proposal Attachments ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_proposal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES pm_proposals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Client Notes ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  note_type TEXT NOT NULL DEFAULT 'general'
    CHECK (note_type IN ('meeting', 'general', 'phone-call', 'follow-up')),
  author TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Client Note Attachments ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_client_note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES pm_client_notes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS Policies for new tables ────────────────────────────────────

ALTER TABLE pm_proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_proposal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_client_note_attachments ENABLE ROW LEVEL SECURITY;

-- Proposal templates: read for all authenticated, write for internal
DO $$ BEGIN
  CREATE POLICY "proposal_templates_select" ON pm_proposal_templates
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposal_templates_insert" ON pm_proposal_templates
    FOR INSERT TO authenticated WITH CHECK (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposal_templates_update" ON pm_proposal_templates
    FOR UPDATE TO authenticated USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposal_templates_delete" ON pm_proposal_templates
    FOR DELETE TO authenticated USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Proposals: internal full CRUD, external read scoped by org
DO $$ BEGIN
  CREATE POLICY "proposals_select" ON pm_proposals
    FOR SELECT TO authenticated USING (
      pm_is_internal() OR pm_has_org_access(org_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposals_insert" ON pm_proposals
    FOR INSERT TO authenticated WITH CHECK (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposals_update" ON pm_proposals
    FOR UPDATE TO authenticated USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposals_delete" ON pm_proposals
    FOR DELETE TO authenticated USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Proposal attachments: follow proposal access
DO $$ BEGIN
  CREATE POLICY "proposal_attachments_select" ON pm_proposal_attachments
    FOR SELECT TO authenticated USING (
      pm_is_internal() OR EXISTS (
        SELECT 1 FROM pm_proposals p WHERE p.id = proposal_id AND pm_has_org_access(p.org_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposal_attachments_insert" ON pm_proposal_attachments
    FOR INSERT TO authenticated WITH CHECK (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposal_attachments_delete" ON pm_proposal_attachments
    FOR DELETE TO authenticated USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Client notes: internal full CRUD, external read scoped by org
DO $$ BEGIN
  CREATE POLICY "client_notes_select" ON pm_client_notes
    FOR SELECT TO authenticated USING (
      pm_is_internal() OR pm_has_org_access(org_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "client_notes_insert" ON pm_client_notes
    FOR INSERT TO authenticated WITH CHECK (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "client_notes_update" ON pm_client_notes
    FOR UPDATE TO authenticated USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "client_notes_delete" ON pm_client_notes
    FOR DELETE TO authenticated USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Client note attachments: follow note access
DO $$ BEGIN
  CREATE POLICY "client_note_attachments_select" ON pm_client_note_attachments
    FOR SELECT TO authenticated USING (
      pm_is_internal() OR EXISTS (
        SELECT 1 FROM pm_client_notes n WHERE n.id = note_id AND pm_has_org_access(n.org_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "client_note_attachments_insert" ON pm_client_note_attachments
    FOR INSERT TO authenticated WITH CHECK (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "client_note_attachments_delete" ON pm_client_note_attachments
    FOR DELETE TO authenticated USING (pm_is_internal_write());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Indexes ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_proposals_org_id ON pm_proposals(org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON pm_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_share_token ON pm_proposals(share_token);
CREATE INDEX IF NOT EXISTS idx_client_notes_org_id ON pm_client_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_proposal_attachments_proposal_id ON pm_proposal_attachments(proposal_id);
CREATE INDEX IF NOT EXISTS idx_client_note_attachments_note_id ON pm_client_note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_organizations_pipeline_status ON pm_organizations(pipeline_status);

-- ─── Seed default SOW template ──────────────────────────────────────

INSERT INTO pm_proposal_templates (slug, name, description, boilerplate, variable_fields, output_format)
VALUES (
  'statement-of-work',
  'Statement of Work',
  'Standard SOW template for consulting engagements',
  E'# Statement of Work\n\n## 1. Overview\n\nThis Statement of Work ("SOW") is entered into between **{{company_name}}** ("Provider") and **{{client_name}}** ("Client") for the services described below.\n\n## 2. Project Description\n\n{{project_description}}\n\n## 3. Scope of Work\n\n{{scope_of_work}}\n\n## 4. Deliverables\n\n{{deliverables}}\n\n## 5. Timeline\n\n- **Start Date:** {{start_date}}\n- **Estimated Completion:** {{end_date}}\n\n## 6. Pricing\n\n{{pricing}}\n\n## 7. Payment Terms\n\n{{payment_terms}}\n\n## 8. Assumptions & Dependencies\n\n{{assumptions}}\n\n## 9. Acceptance\n\nBy signing below, both parties agree to the terms outlined in this SOW.\n\n---\n\n**Provider:** {{company_name}}\n\nSignature: _________________________  Date: ________\n\n**Client:** {{client_name}}\n\nSignature: _________________________  Date: ________',
  '[
    {"name": "company_name", "label": "Your Company Name", "type": "text", "required": true, "placeholder": "Foundation Stone Advisors"},
    {"name": "project_description", "label": "Project Description", "type": "textarea", "required": true, "placeholder": "Describe the project goals and objectives..."},
    {"name": "scope_of_work", "label": "Scope of Work", "type": "textarea", "required": true, "placeholder": "Detail the specific work to be performed..."},
    {"name": "deliverables", "label": "Deliverables", "type": "textarea", "required": true, "placeholder": "List all deliverables..."},
    {"name": "start_date", "label": "Start Date", "type": "date", "required": true, "placeholder": ""},
    {"name": "end_date", "label": "Estimated Completion", "type": "date", "required": true, "placeholder": ""},
    {"name": "pricing", "label": "Pricing", "type": "textarea", "required": true, "placeholder": "Fee structure and amounts..."},
    {"name": "payment_terms", "label": "Payment Terms", "type": "textarea", "required": false, "placeholder": "Net 30, 50% upfront, etc."},
    {"name": "assumptions", "label": "Assumptions & Dependencies", "type": "textarea", "required": false, "placeholder": "Key assumptions and client dependencies..."}
  ]'::jsonb,
  'markdown'
) ON CONFLICT (slug) DO NOTHING;
