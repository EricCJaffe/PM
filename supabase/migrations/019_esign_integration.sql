-- Add eSign tracking columns to generated_documents for DocuSeal integration
ALTER TABLE generated_documents
  ADD COLUMN IF NOT EXISTS esign_provider TEXT,                -- 'docuseal' (future: 'pandadoc', etc.)
  ADD COLUMN IF NOT EXISTS esign_document_hash TEXT,           -- DocuSeal submission ID for API lookups
  ADD COLUMN IF NOT EXISTS esign_status TEXT DEFAULT NULL,     -- waiting|signed|declined|cancelled|expired
  ADD COLUMN IF NOT EXISTS esign_sent_at TIMESTAMPTZ,         -- When sent for signature via eSign
  ADD COLUMN IF NOT EXISTS esign_completed_at TIMESTAMPTZ,    -- When all signers completed
  ADD COLUMN IF NOT EXISTS esign_signers JSONB DEFAULT '[]',  -- Signer status snapshots from DocuSeal
  ADD COLUMN IF NOT EXISTS esign_metadata JSONB DEFAULT '{}'; -- Extra provider-specific data

CREATE INDEX IF NOT EXISTS idx_gen_docs_esign_hash ON generated_documents(esign_document_hash) WHERE esign_document_hash IS NOT NULL;
