-- =============================================================================
-- Migration 039: Fix site audit document_id foreign key
-- The save-to-client-docs feature stores reports in pm_documents, but the FK
-- pointed at generated_documents. Drop the old FK and add the correct one.
-- =============================================================================

-- Drop the old FK constraint pointing to generated_documents
ALTER TABLE pm_site_audits
  DROP CONSTRAINT IF EXISTS pm_site_audits_document_id_fkey;

-- Add correct FK pointing to pm_documents
ALTER TABLE pm_site_audits
  ADD CONSTRAINT pm_site_audits_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES pm_documents(id) ON DELETE SET NULL;
