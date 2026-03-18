# Integrations

## Xodo Sign (eversign) — Digital Signatures

**Purpose:** Send generated documents (SOW, proposals) for digital signature via Xodo Sign (formerly eversign).

**API Docs:** https://eversign.com/api/documentation

### Setup
1. Get your API key from Xodo Sign Developer Settings
2. Set env vars:
   - `EVERSIGN_ACCESS_KEY` — your API key
   - `EVERSIGN_BUSINESS_ID` — business ID (default `1`)
   - `EVERSIGN_SANDBOX=1` — set for testing (non-binding documents)
3. Configure webhook in Xodo Sign Developer Settings:
   - URL: `https://pm.foundationstoneadvisors.com/api/pm/webhooks/esign`
   - Events: all document events

### How It Works
1. User creates & compiles a document (SOW) in the Document Editor
2. Clicks **eSign** button → document is sent to Xodo Sign via API
3. Xodo emails the client (and optionally provider) with signing link
4. Webhook updates document status as signers interact:
   - `document_signed` → individual signer completed
   - `document_completed` → all signers done → status becomes "signed"
   - `document_declined` → signer rejected → status reverts to "draft"
5. Status is also polled via GET `/api/pm/docgen/[id]/esign`

### API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/pm/docgen/[id]/esign` | POST | Send document for eSignature |
| `/api/pm/docgen/[id]/esign` | GET | Check/refresh eSign status |
| `/api/pm/docgen/[id]/esign` | DELETE | Cancel pending eSign request |
| `/api/pm/webhooks/esign` | POST | Xodo Sign webhook receiver |

### Files
- `src/lib/esign.ts` — Xodo Sign API client (create, get, cancel, download, webhook validation)
- `src/app/api/pm/docgen/[id]/esign/route.ts` — eSign API endpoints
- `src/app/api/pm/webhooks/esign/route.ts` — Webhook receiver
- `supabase/migrations/019_esign_integration.sql` — eSign tracking columns

### Database Columns (generated_documents)
| Column | Type | Purpose |
|---|---|---|
| `esign_provider` | text | Provider name (`xodo`) |
| `esign_document_hash` | text | Xodo document hash for API lookups |
| `esign_status` | text | `waiting` / `signed` / `declined` / `cancelled` / `expired` |
| `esign_sent_at` | timestamptz | When sent for signature |
| `esign_completed_at` | timestamptz | When all signers completed |
| `esign_signers` | jsonb | Array of signer status snapshots |
| `esign_metadata` | jsonb | Extra provider data (expiry, etc.) |

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
