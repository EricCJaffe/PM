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
