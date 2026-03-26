# Integrations

## DocuSeal — Digital Signatures

**Purpose:** Send generated documents (SOW, proposals) for digital signature via DocuSeal.

**API Docs:** https://www.docuseal.com/docs/api

### Setup
1. Create an account at https://www.docuseal.com (or self-host)
2. Get your API key from Settings > API
3. Set env vars:
   - `DOCUSEAL_API_KEY` — your API key
   - `DOCUSEAL_API_URL` — only needed for self-hosted (default: `https://api.docuseal.com`)
   - `DOCUSEAL_WEBHOOK_SECRET` — shared secret for webhook verification
4. Configure webhook in DocuSeal Settings > Webhooks:
   - URL: `https://pm.foundationstoneadvisors.com/api/pm/webhooks/esign`
   - Secret header: `X-Docuseal-Secret` = your `DOCUSEAL_WEBHOOK_SECRET` value
   - Events: `form.completed`, `form.declined`, `submission.completed`, `submission.expired`

### How It Works
1. User creates & compiles a document (SOW) in the Document Editor
2. Clicks **eSign** button → the system:
   a. Takes the compiled HTML and injects DocuSeal field tags into the signature block
   b. Replaces static signature lines with `<signature-field>`, `<date-field>`, and `<text-field>` tags
   c. Each field is bound to a submitter role (Client / Provider)
   d. Sends to DocuSeal via `POST /submissions/html` with `documents` array format
3. DocuSeal converts HTML to PDF, renders field tags as interactive form fields, emails the client
4. Client opens the signing link, sees the document with interactive signature/date fields positioned exactly where the tags were placed
5. Webhook updates document status as signers interact:
   - `form.completed` → individual signer completed
   - `submission.completed` → all signers done → status becomes "signed"
   - `form.declined` → signer rejected → status reverts to "draft"
6. Status is also polled via GET `/api/pm/docgen/[id]/esign`

### Field Tag Reference
DocuSeal uses custom HTML tags to define interactive form fields:
- `<signature-field name="..." role="..." required="true">` — Signature pad
- `<date-field name="..." role="..." required="true">` — Auto-filled date picker
- `<text-field name="..." role="..." readonly="true">Prefilled value</text-field>` — Text input
- `<initials-field name="..." role="...">` — Initials pad
- The `role` attribute binds the field to a specific submitter (must match a submitter role)
- The `injectSignatureFields()` helper in `esign.ts` handles this transformation automatically

### API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/pm/docgen/[id]/esign` | POST | Send document for eSignature |
| `/api/pm/docgen/[id]/esign` | GET | Check/refresh eSign status |
| `/api/pm/docgen/[id]/esign` | DELETE | Cancel (archive) pending eSign request |
| `/api/pm/webhooks/esign` | POST | DocuSeal webhook receiver |

### Files
- `src/lib/esign.ts` — DocuSeal API client (createSubmissionFromHtml, getSubmission, archiveSubmission, getSubmissionDocuments, webhook validation)
- `src/app/api/pm/docgen/[id]/esign/route.ts` — eSign API endpoints
- `src/app/api/pm/webhooks/esign/route.ts` — Webhook receiver
- `supabase/migrations/019_esign_integration.sql` — eSign tracking columns

### Database Columns (generated_documents)
| Column | Type | Purpose |
|---|---|---|
| `esign_provider` | text | Provider name (`docuseal`) |
| `esign_document_hash` | text | DocuSeal submitter ID for API lookups |
| `esign_status` | text | `waiting` / `signed` / `declined` / `cancelled` / `expired` |
| `esign_sent_at` | timestamptz | When sent for signature |
| `esign_completed_at` | timestamptz | When all signers completed |
| `esign_signers` | jsonb | Array of signer status snapshots |
| `esign_metadata` | jsonb | Submitter IDs, embed URLs, etc. |

### Pricing
- Cloud: $0.20 per document completion, or $20/mo plan (100 docs)
- Self-hosted: Free (Docker on Railway ~$5-10/mo)

---

## OpenAI — AI Features
- Model: `gpt-4o` via `src/lib/openai.ts`
- Used for: chat, report generation, document section generation, proposal content
- Lazy-initialized via `getOpenAI()` — never top-level

## Resend — Email
- Used for: task assignment notifications, user invites
- Gracefully degrades when key is not set

## GitHub — Vault Export
- Push vault markdown files to a GitHub repo
- Uses `GITHUB_TOKEN` PAT
