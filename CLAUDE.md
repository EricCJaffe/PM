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
- **Branding**: All client-facing output (PDFs, emails, share pages, proposals) must use `getBranding(orgId?)` from `src/lib/branding.ts` — never hardcode company names, colors, or logos. Platform defaults + per-org overrides are resolved automatically. Co-branding modes: `agency-only | co-branded | client-only | white-label`

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
│   ├── kb.ts               # KB context assembly for AI (assembleKBContext)
│   ├── recurrence.ts       # Recurrence engine (occurrence generation, validation)
│   ├── engagement-engine.ts # Stage-change automation (auto-task spawning)
│   ├── branding.ts         # Centralized branding resolver (getBranding, helpers)
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
| `pm_tasks` | Tasks within phases or standalone (status, owner, org_id, deps, subtasks) |
| `pm_risks` | Risk register (probability, impact, mitigation) |
| `pm_daily_logs` | AI-generated or manual daily standups |
| `pm_files` | Index of all vault markdown files |
| `pm_task_comments` | Comment threads on tasks |
| `pm_task_attachments` | File attachments on tasks |
| `pm_task_series` | Recurring task templates (recurrence rules, schedule tracking) |
| `pm_series_exceptions` | Skipped/rescheduled dates for recurring series |
| `pm_proposals` | Client proposals/quotations (status, form_data, generated_content, share_token) |
| `pm_proposal_templates` | Proposal templates (SOW, etc.) with variable_fields JSONB |
| `pm_proposal_attachments` | File attachments on proposals |
| `pm_client_notes` | Client notes (meeting, general, phone-call, follow-up) |
| `pm_client_note_attachments` | File attachments on client notes |
| `pm_kb_articles` | Knowledge base articles (global/org/project scope, AI context) |
| `pm_api_keys` | API keys for external integrations (hashed, scoped permissions) |
| `pm_engagements` | CRM deal engagements per org (deal_stage, value, type) |
| `pm_engagement_attachments` | File attachments on engagements (categorized: discovery, proposal, contract, etc.) |
| `pm_engagement_task_templates` | Stage-triggered auto-task definitions |
| `pm_departments` | Organizational departments within client orgs |
| `pm_department_vocab` | Flexible vocabulary overrides (base terms → display labels) |
| `pm_portal_settings` | Per-org client portal visibility/feature toggles |
| `pm_portal_invites` | Portal access invitations for external users |
| `pm_gap_analysis` | Discovery gap findings (category, severity, resolution tracking) |
| `pm_discovery_interviews` | Structured interview records during discovery |
| `pm_onboarding_checklists` | Template-driven onboarding steps per project |
| `pm_platform_branding` | Singleton platform-level branding (name, logos, colors, fonts, email settings) |
| `pm_org_branding` | Per-org branding overrides (client logo, co-brand mode, color overrides) |

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
| `/api/pm/organizations/pipeline` | GET | List orgs grouped by pipeline stage |
| `/api/pm/proposals` | GET, POST | List / create proposals |
| `/api/pm/proposals/[id]` | GET, PATCH, DELETE | View / update / delete proposal |
| `/api/pm/proposals/[id]/generate` | POST | AI-generate proposal content |
| `/api/pm/proposals/[id]/send` | POST | Mark proposal as sent |
| `/api/pm/proposals/share/[token]` | GET, POST | Public proposal view + accept/decline |
| `/api/pm/proposal-templates` | GET, POST | List / create proposal templates |
| `/api/pm/notes` | GET, POST | List / create client notes |
| `/api/pm/notes/[id]` | PATCH, DELETE | Update / delete note |
| `/api/pm/notes/[id]/attachments` | GET, POST, DELETE | Note file attachments |
| `/api/pm/notes/summarize` | POST | AI-summarize client notes (GPT-4o) |
| `/api/pm/kb` | GET, POST | List / create KB articles |
| `/api/pm/kb/[id]` | GET, PATCH, DELETE | View / update / delete KB article |
| `/api/pm/api-keys` | GET, POST, DELETE | List / create / revoke API keys |
| `/api/pm/engagements` | GET, POST | List / create engagements (by org_id) |
| `/api/pm/engagements/[id]` | GET, PATCH, DELETE | View / update / delete engagement |
| `/api/pm/engagements/[id]/attachments` | GET, POST, DELETE | Engagement file attachments |
| `/api/pm/engagements/[id]/attachments/download` | GET | Signed download URL for attachment |
| `/api/pm/engagements/[id]/project-files` | POST | Re-generate project init files as engagement attachment |
| `/api/cron/engagement-nudge` | POST | Vercel Cron: check overdue engagement tasks |
| `/api/pm/ext/context` | GET | AI agent context dump (orgs, projects, members) |
| `/api/pm/ext/tasks` | GET, POST, PATCH | AI agent task CRUD (API key auth) |
| `/api/pm/ext/notes` | GET, POST | AI agent note read/create (API key auth) |
| `/api/pm/reports/standup` | GET, POST | Generate / fetch AI daily standups |
| `/api/pm/reports/risk-radar` | POST | AI risk radar scan (project or org level) |
| `/api/pm/nlp` | POST | Natural language task updates |
| `/api/pm/site-audit` | GET, POST | List / run site audits (rubric-based scoring) |
| `/api/pm/site-audit/[id]` | GET, POST, DELETE | View / generate doc / delete audit |
| `/api/pm/site-audit/[id]/pdf` | POST | Generate printable HTML audit report |
| `/api/pm/departments` | GET, POST | List / create departments (by org_id) |
| `/api/pm/departments/[id]` | GET, PATCH, DELETE | View / update / delete department |
| `/api/pm/departments/vocab` | GET, POST | Get resolved vocab labels / set overrides |
| `/api/pm/portal` | GET, POST | Get / upsert portal settings (by org_id) |
| `/api/pm/portal/invites` | GET, POST, DELETE | List / create / revoke portal invites |
| `/api/pm/gap-analysis` | GET, POST | List / create gap analysis items |
| `/api/pm/gap-analysis/[id]` | GET, PATCH, DELETE | View / update / delete gap item |
| `/api/pm/discovery-interviews` | GET, POST | List / create discovery interviews |
| `/api/pm/onboarding` | POST | Create onboarding project with discovery tasks |
| `/api/pm/branding` | GET, POST | Get / update platform branding (singleton) |
| `/api/pm/branding/org` | GET, POST | Get / upsert per-org branding overrides |

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

---

## Team Coordination Layer
Read these every session after this file:
- AGENTS.md — four operating modes (Preflight, Build, Stuck, Closeout)
- docs/TEAM.md — ownership map and coordination rules
- docs/ACTIVE_WORK.md — live work status across the team
- docs/HANDOFF.md — session closeout notes
- docs/PROMPT_LIBRARY.md — proven patterns for this codebase
- docs/TROUBLESHOOTING.md — known failure modes
- docs/PRODUCT_ROADMAP.md — where this product is going
