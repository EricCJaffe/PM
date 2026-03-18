# CRM System Implementation Plan

## Overview
Evolve the existing Clients page into a CRM with prospect/client lifecycle management, proposal/quotation builder, and notes system. All new features integrate alongside existing client dashboard tabs.

---

## Phase 1: Database Schema & Types

### Migration: `0XX_crm_foundation.sql`

**New columns on `pm_organizations`:**
- `pipeline_status` — TEXT, default `'lead'`, CHECK constraint: `lead | prospect | proposal_sent | negotiation | client | inactive`
- `contact_name` — TEXT (primary contact)
- `contact_email` — TEXT
- `contact_phone` — TEXT
- `converted_at` — TIMESTAMPTZ (when status changed to `client`)

**New table: `pm_proposals`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| org_id | UUID FK → pm_organizations | |
| template_slug | TEXT | e.g., `statement-of-work` |
| title | TEXT | e.g., "SOW — Acme Corp Website Redesign" |
| status | TEXT | `draft | sent | viewed | accepted | rejected | expired` |
| form_data | JSONB | Variable fields captured from form |
| generated_content | TEXT | AI-generated final document (markdown/HTML) |
| share_token | TEXT UNIQUE | For shareable web link |
| sent_at | TIMESTAMPTZ | |
| viewed_at | TIMESTAMPTZ | |
| responded_at | TIMESTAMPTZ | |
| created_by | TEXT | Member slug |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**New table: `pm_proposal_templates`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| slug | TEXT UNIQUE | e.g., `statement-of-work` |
| name | TEXT | "Statement of Work" |
| description | TEXT | |
| boilerplate | TEXT | Fixed content (markdown) |
| variable_fields | JSONB | Array of field definitions `[{name, label, type, required, placeholder}]` |
| output_format | TEXT | `html | markdown` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**New table: `pm_client_notes`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| org_id | UUID FK → pm_organizations | |
| title | TEXT | |
| body | TEXT | Markdown content |
| note_type | TEXT | `meeting | general | phone-call | follow-up` |
| author | TEXT | Member slug |
| pinned | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**New table: `pm_client_note_attachments`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| note_id | UUID FK → pm_client_notes | |
| file_name | TEXT | |
| file_size | INTEGER | |
| content_type | TEXT | |
| storage_path | TEXT | Supabase Storage path |
| uploaded_by | TEXT | |
| created_at | TIMESTAMPTZ | |

**New table: `pm_proposal_attachments`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proposal_id | UUID FK → pm_proposals | |
| file_name | TEXT | |
| file_size | INTEGER | |
| content_type | TEXT | |
| storage_path | TEXT | |
| uploaded_by | TEXT | |
| created_at | TIMESTAMPTZ | |

**RLS:** Enable on all new tables, follow existing pattern (internal users full CRUD, external scoped by org).

### TypeScript Types (src/types/pm.ts)
- `PipelineStatus` type union
- `Proposal`, `ProposalTemplate`, `ProposalStatus` interfaces
- `ClientNote`, `ClientNoteAttachment` interfaces
- `ProposalAttachment` interface
- Update `Organization` interface with new fields

---

## Phase 2: API Routes

### CRM / Pipeline
| Route | Method | Purpose |
|---|---|---|
| PUT `/api/pm/organizations` | (existing) | Add pipeline_status + contact fields to existing update |
| GET `/api/pm/organizations/pipeline` | GET | List orgs grouped by pipeline stage |

### Proposals
| Route | Method | Purpose |
|---|---|---|
| `/api/pm/proposals` | GET | List proposals (filter by org_id, status) |
| `/api/pm/proposals` | POST | Create draft proposal from template |
| `/api/pm/proposals/[id]` | GET | Get single proposal |
| `/api/pm/proposals/[id]` | PATCH | Update proposal (form data, status) |
| `/api/pm/proposals/[id]` | DELETE | Delete proposal |
| `/api/pm/proposals/[id]/generate` | POST | AI-generate final document from template + form data |
| `/api/pm/proposals/[id]/send` | POST | Mark as sent, (future: trigger email) |
| `/api/pm/proposals/[id]/pdf` | GET | Generate PDF download |
| `/api/pm/proposals/share/[token]` | GET | Public shareable view (no auth) |
| `/api/pm/proposal-templates` | GET | List available templates |
| `/api/pm/proposal-templates` | POST | Create/update template |

### Notes
| Route | Method | Purpose |
|---|---|---|
| `/api/pm/notes` | GET | List notes for org (with pagination) |
| `/api/pm/notes` | POST | Create note |
| `/api/pm/notes/[id]` | PATCH | Update note |
| `/api/pm/notes/[id]` | DELETE | Delete note |
| `/api/pm/notes/[id]/attachments` | GET, POST, DELETE | Note file attachments |

### Email (UI-ready, wiring later)
| Route | Method | Purpose |
|---|---|---|
| `/api/pm/proposals/[id]/email` | POST | Queue/send proposal email (uses existing Resend lib) |

---

## Phase 3: Query Functions (src/lib/queries.ts)

Add:
- `getOrganizationsByPipeline()` — grouped by status
- `getProposals(orgId)` — all proposals for an org
- `getProposalById(id)` — single proposal with template data
- `getProposalByShareToken(token)` — for public view
- `getProposalTemplates()` — all templates
- `getClientNotes(orgId)` — paginated notes
- `getClientNoteById(id)` — single note with attachments

---

## Phase 4: UI Components

### 4a. Clients List Page Evolution (`/clients`)
- Add pipeline status badge to each client card (color-coded by stage)
- Add pipeline filter/view toggle: "All" | "Leads" | "Prospects" | "Proposal Sent" | "Negotiation" | "Clients" | "Inactive"
- Add pipeline status dropdown to the create/edit form
- Add contact fields (name, email, phone) to create/edit form
- Optional: Kanban board view showing cards in pipeline columns

### 4b. New Dashboard Tabs

**Info Tab** (`src/components/dashboard/InfoTab.tsx`)
- Company details: name, address, phone, website
- Primary contact: name, email, phone
- Pipeline status with stage-change controls (advance/revert)
- Timeline of status changes
- Quick stats: total proposals, active projects, last activity

**Proposals Tab** (`src/components/dashboard/ProposalsTab.tsx`)
- List of all proposals for this client (sortable by date, status)
- Status badges: Draft, Sent, Viewed, Accepted, Rejected, Expired
- "New Proposal" button → template picker → form wizard
- Each proposal row: title, template type, status, date, actions (view, edit, send, download PDF, copy link)

**Proposal Builder** (modal or slide-over):
1. Select template (e.g., Statement of Work)
2. Auto-populate client info (name, contact, address)
3. Form for variable fields (defined by template's `variable_fields` JSONB)
4. Preview generated document
5. Save as draft or send

**Notes Tab** (`src/components/dashboard/NotesTab.tsx`)
- List of all notes (newest first, with pinned at top)
- Note type filter (meeting, general, phone call, follow-up)
- Inline create/edit form
- File attachments with drag-and-drop upload
- Each note shows: title, body preview, author, date, attachment count

### 4c. Proposal Public View Page
- `/proposals/view/[token]` — public page (no auth required)
- Renders generated proposal content in branded layout
- "Accept" / "Decline" buttons (updates proposal status)
- Download PDF button

### 4d. Proposal PDF Generation
- Use server-side HTML → PDF (e.g., Puppeteer, or `@react-pdf/renderer`)
- Template defines layout, AI-generated content fills body
- Includes: company logo area, client info header, document body, signature block placeholder

---

## Phase 5: AI Integration

### Proposal Document Generation
- Endpoint: `/api/pm/proposals/[id]/generate`
- Input: template boilerplate + variable field values + client info
- System prompt instructs GPT-4o to:
  - Merge boilerplate with form inputs
  - Format as professional document
  - Maintain consistent tone and legal language
  - Output structured HTML with semantic sections
- Store result in `generated_content` column

### Future: AI-assisted note summarization, proposal analytics

---

## Phase 6: File Management

### Storage Structure
```
vault/[org-slug]/
  proposals/[proposal-slug]/
    proposal.html           # Generated content
    proposal.pdf            # Generated PDF
    attachments/            # Additional files
  notes/
    [note-id]/
      attachments/          # Note file attachments
```

### Document Library (enhanced Docs tab)
- All proposals auto-saved to file management
- Notes with attachments indexed
- Search/filter across all document types

---

## Phase 7: Email UI (send later)

### Compose Email Modal
- To: pre-filled with client contact email
- Subject: pre-filled with proposal title
- Body: template with proposal summary + shareable link
- Attach PDF toggle
- Preview before "sending"
- For now: saves email record as "queued" — actual sending wired when email service configured

---

## Implementation Order (Suggested)

1. **Migration + Types** — Schema first, get the data model right
2. **API Routes** — CRUD for proposals, notes, pipeline updates
3. **Info Tab** — Contact management + pipeline status on client detail
4. **Notes Tab** — Notes CRUD with file attachments
5. **Proposal Templates** — Template model + seed one blank SOW template
6. **Proposals Tab + Builder** — Template picker, form wizard, list view
7. **AI Generation** — GPT-4o document generation from template + form
8. **PDF Generation** — Server-side PDF from generated content
9. **Public Share Page** — Shareable proposal link
10. **Email UI** — Compose modal with queued sending

---

## Doc Signing (Future)
Design the proposal flow to hand off to a third-party service (DocuSign, HelloSign, PandaDoc) when ready. The `share_token` + `status` workflow already models the accept/reject lifecycle. Integration would:
- Replace "Accept/Decline" buttons with embedded signing widget
- Add `signed_at`, `signing_provider`, `signing_id` columns
- Webhook handler for signing completion events

---

## Dependencies / Decisions Needed
1. **PDF library choice**: `@react-pdf/renderer` (React-native PDF) vs Puppeteer (headless Chrome) vs `html-pdf-node`
2. **SOW template content**: User to provide boilerplate text + sample finished document
3. **Email service**: Already have Resend configured in `src/lib/email.ts` — can wire up when ready
4. **Kanban view**: Optional enhancement for pipeline visualization — build after core flow works
