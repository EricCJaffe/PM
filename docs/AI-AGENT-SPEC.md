# AI Agent Integration Spec — BusinessOS PM

This document provides everything an external AI agent needs to authenticate and interact with the BusinessOS PM system.

## Authentication

All requests to `/api/pm/ext/*` require a Bearer token:

```
Authorization: Bearer pm_key_<hex>
```

API keys are created in **Settings > API Keys** by an admin user. The full key is shown once at creation — store it securely.

### Key Properties
- **Permissions**: JSON object with `read` and `write` arrays listing allowed resource types
- **Org Scope**: `null` = access to all orgs, or an array of specific org UUIDs
- **Expiration**: Optional — keys without expiration last until manually revoked

Default permissions for new keys:
```json
{
  "read": ["orgs", "projects", "members", "phases", "tasks", "notes"],
  "write": ["tasks", "notes"]
}
```

---

## Base URL

```
https://<your-deployment-url>
```

All endpoints below are relative to this base.

---

## Endpoints

### 1. GET /api/pm/ext/context — Get System Context

Use this first to understand the system state. Returns orgs, members, and optionally deep context for a specific org.

**High-level context (all orgs):**
```
GET /api/pm/ext/context
```

Response:
```json
{
  "organizations": [
    { "id": "uuid", "slug": "acme-corp", "name": "Acme Corp", "pipeline_status": "client", "contact_name": "Jane Smith" }
  ],
  "members": [
    { "slug": "eric-jaffe", "display_name": "Eric Jaffe", "email": "eric@example.com", "role": "owner" }
  ]
}
```

**Deep context for one org:**
```
GET /api/pm/ext/context?org_id=<uuid>
```

Response adds: `organization`, `projects`, `members`, `phases`, `recent_tasks`, `recent_notes`, `all_organizations`

### 2. Tasks

#### List Tasks
```
GET /api/pm/ext/tasks?org_id=<uuid>&status=not-started&assigned_to=eric-jaffe&limit=50
```

All query params are optional. Response:
```json
{
  "tasks": [
    {
      "id": "uuid",
      "name": "Follow up on contract",
      "slug": "follow-up-on-contract",
      "description": "Send revised terms",
      "status": "not-started",
      "owner": "eric-jaffe",
      "assigned_to": "eric-jaffe",
      "due_date": "2026-03-25",
      "org_id": "uuid",
      "project_id": null,
      "created_at": "2026-03-18T..."
    }
  ],
  "count": 1
}
```

#### Create Task
```
POST /api/pm/ext/tasks
Content-Type: application/json

{
  "name": "Follow up on contract review",       // REQUIRED
  "description": "Send revised terms by Friday", // optional
  "status": "not-started",                       // optional, default: "not-started"
  "assigned_to": "eric-jaffe",                   // optional, member slug
  "due_date": "2026-03-25",                      // optional, YYYY-MM-DD
  "org_id": "uuid",                              // optional, ties to a client
  "project_id": "uuid"                           // optional, ties to a project (auto-sets org_id)
}
```

**Task types by field combination:**
| org_id | project_id | Type |
|--------|-----------|------|
| null | null | Personal task |
| set | null | Client task (no project) |
| set | set | Project task |

#### Update Task
```
PATCH /api/pm/ext/tasks
Content-Type: application/json

{
  "id": "task-uuid",         // REQUIRED
  "status": "complete",      // any allowed field
  "due_date": "2026-04-01"
}
```

Updatable fields: `name`, `status`, `owner`, `assigned_to`, `due_date`, `description`, `org_id`, `project_id`

### 3. Notes

#### List Notes
```
GET /api/pm/ext/notes?org_id=<uuid>&note_type=meeting&limit=20
```

`org_id` is required. Response:
```json
{
  "notes": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "title": "Q1 Review Meeting",
      "body": "Discussed roadmap...",
      "note_type": "meeting",
      "author": "Eric Jaffe",
      "created_at": "2026-03-18T..."
    }
  ],
  "count": 1
}
```

#### Create Note
```
POST /api/pm/ext/notes
Content-Type: application/json

{
  "org_id": "uuid",                    // REQUIRED
  "title": "Call with Jane Smith",     // REQUIRED
  "body": "Discussed timeline...",     // optional
  "note_type": "phone-call",          // optional: general | meeting | phone-call | follow-up
  "author": "AI Assistant"            // optional, defaults to API key name
}
```

---

## Field Reference

### Status Values (tasks)
`not-started` | `in-progress` | `complete` | `blocked` | `pending` | `on-hold`

### Note Types
`general` | `meeting` | `phone-call` | `follow-up`

### Pipeline Stages (orgs, read-only)
`lead` | `prospect` | `proposal_sent` | `negotiation` | `client` | `inactive`

### Member Slugs
Members are identified by kebab-case slugs (e.g., `eric-jaffe`). Use the context endpoint to discover valid slugs.

---

## AI Agent System Prompt Template

Use this as the system prompt for an OpenAI Assistant or similar:

```
You are an AI assistant for Foundation Stone Advisors' project management system (BusinessOS PM).

## Authentication
You have an API key for the PM system. Include it in every request:
Authorization: Bearer <YOUR_API_KEY>

Base URL: <YOUR_BASE_URL>

## Your Capabilities
1. **Read context**: GET /api/pm/ext/context to understand orgs, projects, members, tasks
2. **Create tasks**: POST /api/pm/ext/tasks — follow-ups, action items, to-dos
3. **Update tasks**: PATCH /api/pm/ext/tasks — mark complete, change status, reassign
4. **Create notes**: POST /api/pm/ext/notes — log calls, meetings, follow-ups
5. **Read tasks/notes**: GET /api/pm/ext/tasks, GET /api/pm/ext/notes

## Workflow
1. When asked to create a task, ALWAYS fetch context first to get valid org_id and member slugs
2. Set due_date when possible (YYYY-MM-DD format)
3. Assign tasks to the appropriate member slug
4. For client-related tasks, include the org_id
5. For general/personal tasks, omit org_id

## Key Members
- eric-jaffe: Eric Jaffe (Owner, Managing Consultant)
[Add other team members as needed]

## Task Creation Rules
- Always provide a clear, actionable name
- Include description with context when possible
- Set status to "not-started" for new tasks
- Use due_date for time-sensitive items
- Assign to the appropriate team member

## Note Creation Rules
- Use the correct note_type: meeting, phone-call, follow-up, or general
- Include the org_id for the relevant client
- Write clear, professional summaries
```

---

## Error Handling

| Status | Meaning |
|--------|---------|
| 401 | Invalid or missing API key |
| 403 | Key doesn't have required permission or org access |
| 400 | Missing required fields |
| 404 | Referenced entity not found |
| 500 | Server error |

All errors return `{ "error": "description" }`.

---

## Setup Checklist

1. Go to **Settings** in the PM app (must be admin)
2. Scroll to **API Keys** section
3. Click **+ New Key**, name it (e.g., "OpenAI Assistant")
4. **Copy the key immediately** — it's shown only once
5. Configure your AI agent with the key and this spec
6. Test with `GET /api/pm/ext/context` to verify access
