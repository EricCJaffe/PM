-- =============================================================================
-- Migration 017: Document Generation Module
-- Adds document_types, document_intake_fields, generated_documents,
-- document_sections, and document_activity tables.
-- Additive only — no existing tables are modified.
-- =============================================================================

-- ─── 1. document_types ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,                          -- e.g. "Statement of Work"
  slug          TEXT NOT NULL UNIQUE,                   -- e.g. "sow"
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'proposal',       -- proposal | contract | report | internal
  html_template TEXT NOT NULL DEFAULT '',               -- Handlebars HTML template
  css_styles    TEXT NOT NULL DEFAULT '',               -- Scoped CSS for PDF rendering
  header_html   TEXT NOT NULL DEFAULT '',               -- Repeated header
  footer_html   TEXT NOT NULL DEFAULT '',               -- Repeated footer
  variables     JSONB NOT NULL DEFAULT '{}',            -- Default variable values
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. document_intake_fields ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_intake_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  field_key       TEXT NOT NULL,                        -- e.g. "client_name"
  label           TEXT NOT NULL,                        -- e.g. "Client / Company Name"
  field_type      TEXT NOT NULL DEFAULT 'text',         -- text | textarea | number | date | select | multi-select | currency | toggle
  options         JSONB,                                -- For select / multi-select
  default_value   TEXT,
  placeholder     TEXT,
  help_text       TEXT,
  validation      JSONB,                                -- { required, min, max, pattern }
  section         TEXT NOT NULL DEFAULT 'general',      -- Grouping label
  sort_order      INT NOT NULL DEFAULT 0,
  is_required     BOOLEAN NOT NULL DEFAULT false,
  ai_hint         TEXT,                                 -- Prompt hint for AI assist
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_type_id, field_key)
);

-- ─── 3. generated_documents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  org_id           UUID REFERENCES pm_organizations(id) ON DELETE SET NULL,
  project_id       UUID REFERENCES pm_projects(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',       -- draft | review | approved | sent | signed | archived
  intake_data      JSONB NOT NULL DEFAULT '{}',         -- Filled-in form values
  compiled_html    TEXT,                                 -- Final merged HTML
  pdf_storage_path TEXT,                                 -- Supabase Storage path
  version          INT NOT NULL DEFAULT 1,
  created_by       UUID REFERENCES auth.users(id),
  sent_at          TIMESTAMPTZ,
  signed_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. document_sections ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
  section_key   TEXT NOT NULL,                          -- e.g. "scope_of_work"
  title         TEXT NOT NULL,
  content_html  TEXT NOT NULL DEFAULT '',
  sort_order    INT NOT NULL DEFAULT 0,
  is_locked     BOOLEAN NOT NULL DEFAULT false,         -- Prevents AI overwrite
  ai_generated  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. document_activity ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,                            -- created | edited | generated | approved | sent | signed | comment
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_intake_fields_type ON document_intake_fields(document_type_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_gen_docs_org       ON generated_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_project   ON generated_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_type      ON generated_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_status    ON generated_documents(status);
CREATE INDEX IF NOT EXISTS idx_doc_sections_doc   ON document_sections(document_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_doc_activity_doc   ON document_activity(document_id, created_at DESC);

-- ─── Updated-at triggers ────────────────────────────────────────────────────
CREATE TRIGGER set_document_types_updated_at
  BEFORE UPDATE ON document_types
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

CREATE TRIGGER set_generated_documents_updated_at
  BEFORE UPDATE ON generated_documents
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

CREATE TRIGGER set_document_sections_updated_at
  BEFORE UPDATE ON document_sections
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

-- ─── Storage bucket for PDFs ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
