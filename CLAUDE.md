# BusinessOS — PM (Project Management Module)

## Build & Development Commands
- `npm run dev` — local dev server (Next.js)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run seed` — seed project templates to Supabase (`npx tsx supabase/seeds/seed.ts`)
- TypeScript scripts: `npx tsx scripts/<name>.ts`

## Tech Stack
- Next.js 15+ (App Router) + TypeScript
- Tailwind CSS (dark theme — bg: `#0f172a`, card: `#1e293b`, text: `#e2e8f0`)
- Supabase (auth, Postgres + RLS, Storage for vault files)
- `@supabase/ssr` for server/client session management
- OpenAI SDK (`gpt-4o`) for AI chat, report generation, project analysis
- `gray-matter` for YAML frontmatter parsing in markdown vault files
- Vercel for deployment (auto-deploys on push to `main`)
- GitHub: `EricCJaffe/PM`

## Architecture — Dual-Layer Storage
Every project object lives in two places simultaneously:
1. **Supabase DB** — structured columns for fast queries, dashboards, and AI reasoning
2. **Supabase Storage** — `.md` files with YAML frontmatter at `vault/[org-slug]/[project-slug]/...`

Writes go to DB first, then generate/update the `.md` file. Reads use DB for structured queries, Storage files for full content display and export.

## Doc Maintenance Rules
When making changes, update the relevant docs **in the same commit**:

| Change type | Update |
|---|---|
| Major architectural decision | New ADR in `docs/DECISIONS/NNNN-<slug>.md` |
| New or changed feature | `docs/TASKS.md` (mark done or add new) |
| New integration or service | `docs/INTEGRATIONS.md` |
| New env var or secret | `docs/ENVIRONMENT.md` |
| Workflow or process change | `docs/WORKFLOWS.md` or `docs/RUNBOOK.md` |
| Release or deployment | `docs/RELEASES.md` |
| Security change | `docs/SECURITY.md` |
| API change | `docs/API.md` |
| Supabase schema or vault change | `docs/SUPABASE.md` |

## Code Conventions
- **Server Components by default** — only add `'use client'` when interactivity or browser APIs are required
- **Supabase server client** (`src/lib/supabase/server.ts`) in Server Components and Route Handlers
- **Supabase browser client** (`src/lib/supabase/client.ts`) in Client Components only
- **OpenAI client** — use lazy-init via `getOpenAI()` from `src/lib/openai.ts` (never top-level instantiation, breaks build without env vars)
- **Server Actions** for all data mutations — never raw `fetch()` to internal APIs from components (exception: client-side forms that call API routes directly)
- **Never put secrets** (service role key, OpenAI API key, GitHub token) in `NEXT_PUBLIC_*` env vars
- Route protection via middleware when auth is enabled — `/dashboard/**` requires auth
- **Entities must pre-exist**: Organizations and members must be created before projects. Owner must be a validated member of the selected org.
- Status values are standardized: `not-started | in-progress | complete | blocked | pending | on-hold`

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/pm/             # API route handlers
│   │   ├── chat/           # AI chat endpoint
│   │   ├── organizations/  # Org CRUD
│   │   ├── members/        # Member CRUD
│   │   ├── projects/seed/  # Project creation from template
│   │   ├── phases/clone/   # Phase cloning (department discovery)
│   │   ├── reports/        # rollup, blockers, hub, decisions
│   │   └── export/github/  # Vault → GitHub sync
│   ├── projects/           # Project list, detail, new
│   └── page.tsx            # Landing page
├── components/             # React components
│   ├── ChatPanel.tsx       # AI chat interface
│   ├── PhaseCard.tsx       # Phase board cards
│   ├── ProjectCard.tsx     # Project list cards
│   ├── StatusBadge.tsx     # Status pill component
│   ├── ProgressBar.tsx     # Progress bar component
│   ├── StatsBar.tsx        # Stats overview bar
│   ├── TabNav.tsx          # Tab navigation
│   ├── TaskTable.tsx       # Task list table
│   └── RiskTable.tsx       # Risk register table
├── lib/
│   ├── supabase/           # client.ts, server.ts
│   ├── openai.ts           # Lazy-init OpenAI client
│   ├── queries.ts          # All Supabase query functions
│   ├── recurrence.ts       # Recurrence engine (occurrence generation, validation)
│   └── vault.ts            # Vault storage read/write/generation
└── types/
    └── pm.ts               # All TypeScript types
supabase/
├── migrations/             # SQL migrations (numbered)
│   ├── 001_pm_schema.sql          # Core PM tables
│   ├── 002_add_missing_columns.sql # Additive column patches
│   └── 003_orgs_and_members.sql   # Organizations + members
└── seeds/
    └── seed.ts             # Template seeding script
docs/                       # Project documentation
```

## Database Tables
| Table | Purpose |
|---|---|
| `pm_organizations` | Tenant orgs (id, slug, name) |
| `pm_members` | Org members (slug, display_name, email, role) |
| `pm_project_templates` | Template definitions with phase JSONB |
| `pm_projects` | Projects linked to org + template |
| `pm_phases` | Phases within projects (ordered, grouped) |
| `pm_tasks` | Tasks within phases (status, owner, deps, subtasks) |
| `pm_risks` | Risk register (probability, impact, mitigation) |
| `pm_daily_logs` | AI-generated or manual daily standups |
| `pm_files` | Index of all vault markdown files |
| `pm_task_comments` | Comment threads on tasks |
| `pm_task_attachments` | File attachments on tasks |
| `pm_task_series` | Recurring task templates (recurrence rules, schedule tracking) |
| `pm_series_exceptions` | Skipped/rescheduled dates for recurring series |

## Project Templates
| Slug | Name | Phases |
|---|---|---|
| `saas-rollout` | SaaS App Rollout | 26 phases in BUILD/GTM/GROW/FOUNDATION |
| `ministry-discovery` | Ministry / Org Discovery | 7 phases with department sublayer cloning |
| `tech-stack-modernization` | Tech Stack Modernization (PMBOK) | 12 PMBOK management sections |
| `custom` | Custom | Blank slate |

## Vault Folder Structure
```
vault/[org-slug]/[project-slug]/
  PROJECT.md, RISKS.md, DECISIONS.md, STATUS.md
  /phases/pNN-[phase-name]/STATUS.md, DECISIONS.md, RESOURCES.md
  /tasks/t-[task-slug].md
  /people/[firstname-lastname].md
  /daily/YYYY-MM-DD.md
  /ai/prompts.md, /reports/WEEKLY-ROLLUP-YYYY-MM-DD.md, BLOCKER-SCAN-YYYY-MM-DD.md
```

## API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/pm/organizations` | GET, POST | List / create orgs |
| `/api/pm/members` | GET, POST | List / add org members |
| `/api/pm/members/assignable` | GET | List assignable members (site staff + org members) |
| `/api/pm/projects/seed` | POST | Create project from template |
| `/api/pm/chat` | POST | AI chat with project context |
| `/api/pm/reports/rollup` | POST | Generate weekly rollup |
| `/api/pm/reports/blockers` | POST | Generate blocker scan |
| `/api/pm/reports/hub` | POST | Cross-project hub report |
| `/api/pm/reports/decisions` | POST | Compile decision register |
| `/api/pm/phases/clone` | POST | Clone phase with sublayers |
| `/api/pm/export/github` | POST | Push vault to GitHub repo |
| `/api/pm/tasks/my` | GET | Cross-project tasks for a user |
| `/api/pm/tasks/[id]/comments` | GET, POST, DELETE | Task comment threads |
| `/api/pm/tasks/[id]/attachments` | GET, POST, DELETE | Task file attachments |
| `/api/pm/templates/generate` | POST | AI-generate template phases/tasks |
| `/api/pm/series` | GET, POST | List / create recurring task series |
| `/api/pm/series/[id]` | GET, PATCH, DELETE | View / update / delete a series |
| `/api/pm/series/[id]/exceptions` | POST, DELETE | Add / remove skip/reschedule exceptions |
| `/api/pm/series/generate` | POST | Generate task instances for due series |

## Security Rules
- **Never** put OpenAI API keys, service role keys, or GitHub tokens in `NEXT_PUBLIC_*` vars
- Supabase service role client used only in API routes and server actions, never exposed to client
- RBAC: org member roles (owner, admin, member, viewer) — enforce at DB layer via RLS
- RLS should be enabled on all PM tables — verify policies before every migration
- Validate entity relationships server-side (org exists, owner is org member) before mutations

## Environment Variables
| Variable | Required | Context |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only |
| `OPENAI_API_KEY` | Yes | Server only |
| `GITHUB_TOKEN` | No | Server only (vault export) |
| `GITHUB_VAULT_REPO` | No | Server only (vault export) |

## Daily Workflow Prompts

### Starting your day
> "Pull latest and get up to speed"

This tells Claude to:
1. `git pull origin main` to get the latest code
2. Read `docs/CONTEXT.md`, `docs/ENVIRONMENT.md`, `docs/TASKS.md`, `docs/RUNBOOK.md`
3. Summarize what's in progress and what's next

### Ending your day
> "End of day — commit, push, and update tasks"

This tells Claude to:
1. Update `docs/TASKS.md` with completed and newly discovered work
2. Commit all changes with clear messages
3. Push to the working branch
4. Give a summary of what was done and what's next

## On Session Start (Claude instructions)
Read these docs automatically before doing any work:
1. `docs/CONTEXT.md` — purpose, architecture, module scope
2. `docs/ENVIRONMENT.md` — env vars and secrets map
3. `docs/TASKS.md` — active tasks, backlog, completed work
4. `docs/RUNBOOK.md` — operational procedures
5. Scan `docs/DECISIONS/` for ADRs relevant to the current task

If the session involves a specific subsystem, also read:
- AI features → `docs/INTEGRATIONS.md`
- Vault / markdown → `src/lib/vault.ts`
- Deployment → `docs/DEPLOYMENT.md`
- Supabase schema → `docs/SUPABASE.md` + `supabase/migrations/`
- Security/RBAC → `docs/SECURITY.md`

## On Session End (Claude instructions)
Before ending a session with meaningful changes:
1. Ensure `docs/TASKS.md` reflects completed and newly discovered work
2. Commit all changes with clear messages (include doc updates in same commit)
3. Push to the working branch
