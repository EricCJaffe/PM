# API Reference

All routes are under `/api/pm/`.

## Organizations

### `GET /api/pm/organizations`
List all organizations.

**Response:** `Organization[]`

### `POST /api/pm/organizations`
Create a new organization.

**Body:** `{ name: string, slug: string }`
**Response:** `Organization`
**Errors:** 409 if slug already exists

---

## Members

### `GET /api/pm/members?org_id=<uuid>`
List members for an organization.

**Query:** `org_id` (required)
**Response:** `Member[]`

### `POST /api/pm/members`
Add a member to an organization.

**Body:** `{ org_id: string, slug: string, display_name: string, email?: string, role?: string }`
**Response:** `Member`
**Errors:** 409 if slug already exists in org

---

## Projects

### `POST /api/pm/projects/seed`
Create a project from a template. Creates DB rows, vault files, and file index.

**Body:**
```json
{
  "name": "Project Name",
  "slug": "project-slug",
  "template_slug": "saas-rollout",
  "org_id": "uuid",
  "description": "optional",
  "owner": "member-slug",
  "target_date": "2026-07-31",
  "budget": 50000
}
```
**Validation:** org must exist, owner must be a member of org
**Response:** `{ project, phases_created, vault_files, vault_errors }`

---

## AI Chat

### `POST /api/pm/chat`
Send a message to the AI assistant with project context.

**Body:** `{ project_id: string, project_slug: string, message: string, history?: Array }`
**Response:** `{ response: string, metadata: { model, usage } }`

---

## Reports

### `POST /api/pm/reports/rollup`
Generate AI weekly status rollup. Persisted to vault.

**Body:** `{ project_id, org_slug, project_slug }`

### `POST /api/pm/reports/blockers`
Generate AI blocker scan. Persisted to vault.

**Body:** `{ project_id, org_slug, project_slug }`

### `POST /api/pm/reports/hub`
Generate cross-project hub report. Persisted to vault.

**Body:** `{ org_slug }`

### `POST /api/pm/reports/decisions`
Compile decision register from all DECISIONS.md files. Persisted to vault.

**Body:** `{ project_id, org_slug, project_slug }`

---

## Phases

### `POST /api/pm/phases/clone`
Clone a phase with sublayers (used for ministry department discovery).

**Body:** `{ project_id, org_slug, project_slug, phase_name, phase_slug, order?, sublayers? }`
**Default sublayers:** prayer, vision, people, data, process, meetings, issues

---

## Export

### `POST /api/pm/export/github`
Push vault files to GitHub repo.

**Body:** `{ org_slug, project_slug? }`
**Requires:** `GITHUB_TOKEN` and `GITHUB_VAULT_REPO` env vars

---

## Document Generation

### `GET /api/pm/document-types`
List active document types.
**Response:** `DocumentType[]`

### `POST /api/pm/document-types`
Create or update a document type (upsert by slug).
**Body:** `{ slug, name, description?, category?, html_template?, css_styles?, header_html?, footer_html?, variables?, is_active? }`

### `GET /api/pm/document-types/[slug]/fields`
Get intake fields for a document type.
**Response:** `DocumentIntakeField[]`

### `GET /api/pm/docgen?org_id=&status=`
List generated documents, optionally filtered by org and/or status.
**Response:** `GeneratedDocument[]` (with document_type_name, document_type_slug joined)

### `POST /api/pm/docgen`
Create a new generated document (draft).
**Body:** `{ document_type_id, title, org_id?, project_id?, intake_data? }`
**Response:** `GeneratedDocument` (201)
**Side effects:** Creates default sections from document type variables, logs activity.

### `GET /api/pm/docgen/[id]`
Get a single document with template info.

### `PATCH /api/pm/docgen/[id]`
Update document fields.
**Body:** `{ title?, status?, intake_data?, compiled_html?, pdf_storage_path?, org_id?, project_id? }`

### `DELETE /api/pm/docgen/[id]`
Delete a generated document.

### `GET /api/pm/docgen/[id]/sections`
List sections for a document.

### `PATCH /api/pm/docgen/[id]/sections`
Bulk update sections.
**Body:** `{ sections: [{ id?, section_key?, title?, content_html?, sort_order?, is_locked? }] }`

### `POST /api/pm/docgen/[id]/generate`
AI-generate section content using GPT-4o.
**Body:** `{ section_keys?: string[] }` (optional: generate specific sections only; omit for all unlocked)
**Respects:** `is_locked` flag — locked sections are never overwritten.

### `POST /api/pm/docgen/[id]/pdf`
Compile final HTML from template + sections + intake data. Stores `compiled_html` on the document.
**Response:** `{ compiled_html: string }`

### `POST /api/pm/docgen/[id]/send`
Mark document as sent (sets status="sent", sent_at=now).

---

## Site Audit

### `GET /api/pm/site-audit?org_id=<uuid>`
List audits for an organization.

**Response:** `SiteAudit[]`

### `POST /api/pm/site-audit`
Run a new site audit. Fetches the homepage + subpages, scores via GPT-4o against a vertical rubric, and generates a rebuilt site mockup.

**Body:** `{ org_id: string, url: string, vertical: "church" | "agency" | "nonprofit" | "general", engagement_id?: string, extra_context?: string }`
**Response:** `SiteAudit` (status: 201)

### `GET /api/pm/site-audit/[id]`
Get a single audit with full results.

**Response:** `SiteAudit`

### `DELETE /api/pm/site-audit/[id]`
Delete an audit record.

### `POST /api/pm/site-audit/[id]`
Generate a document (report) from completed audit results. Creates entries in `generated_documents` + `document_sections`.

**Response:** `{ document_id: string }` (status: 201)

### `POST /api/pm/site-audit/[id]/pdf`
Generate a printable HTML report with cover page, score cards, gap tables, and quick wins.

**Response:** HTML file attachment (`Content-Type: text/html`)

### Standalone Page
`/site-audit` — Run audits without an existing engagement. Includes org selector and full audit UI.

---

## Standup Agent

### `POST /api/pm/standup/generate`
Generate morning standup from live project data across all active projects for an org.

**Body:** `{ org_id: string, date?: string, send_email?: boolean, email_to?: string }`
**Response:** `{ content: string, date: string, org_id: string, projects_covered: number, blocked_count: number, overdue_count: number }`

### `GET /api/pm/standup?org_id=<uuid>&limit=7`
List standup history for an org. Default limit 7 (one week).

**Response:** `DailyLog[]` (filtered to log_type=standup)

### `POST /api/cron/standup` (Vercel Cron)
Auto-generates standup for all orgs with active projects. Runs weekdays at 8am.

**Auth:** `Authorization: Bearer {CRON_SECRET}`
**Response:** `{ generated: number, results: [...] }`

---

## Client Update Generator

### `POST /api/pm/client-update/generate`
Generate a weekly client update draft from project data using GPT-4o.

**Body:** `{ project_id: string, client_email: string, client_name: string, period_start?: string, period_end?: string, tone?: "friendly" | "formal" }`
**Response:** `{ note_id, subject, body, status: "draft" }` (status: 201)

### `GET /api/pm/client-update?project_id=<uuid>&org_id=<uuid>`
List client updates for a project or org.

**Response:** `ClientNote[]` (filtered to note_type=client-update)

### `GET /api/pm/client-update/[id]`
Get single client update note.

### `PATCH /api/pm/client-update/[id]`
Edit draft body or subject before sending. Cannot edit sent updates.

**Body:** `{ body?: string, subject?: string, sent_to_email?: string, sent_to_name?: string }`

### `POST /api/pm/client-update/[id]/send`
Send approved draft to client via Resend. Marks note as sent.

**Response:** `{ sent: true, sent_at: string, sent_to: string }`

---

## Project Intake

### `POST /api/pm/projects/intake`
Create project from full intake form. Creates project + phases from template,
stores intake_data and client_context, generates zip with pre-filled markdown files.

**Body:** `{ name, slug, org_id, template_slug, owner, description?, target_date?, budget?, engagement_id?, intake_data, client_context }`
**Response:** `{ project, project_id, phases_created, download_url, storage_path }` (status: 201)

### `GET /api/pm/projects/[id]/init-files`
Regenerate download zip for an existing project with intake data.

**Response:** `{ download_url }`
