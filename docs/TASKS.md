# Tasks

## In Progress
- [ ] Apply migrations to Supabase and seed templates
- [ ] Create initial orgs and members via API
- [ ] End-to-end test: create project from template, verify vault files

## Backlog
- [ ] Add RLS policies to all PM tables
- [ ] Auth integration (shared Supabase auth with FSA)
- [ ] Middleware route protection for `/projects/**`
- [ ] AI daily standup generation (`/daily/YYYY-MM-DD.md`)
- [ ] Risk radar — AI scan of escalating risks
- [ ] Natural language updates ("Set X due date to April 15")
- [ ] Supabase realtime subscriptions for live dashboard updates
- [ ] Client portal (Phase 2) — `org_viewer` role, `/portal/[org-slug]/projects`
- [ ] Seed Honey Lake Digital and VakPak as sample projects
- [ ] Timeline view (Gantt-style) for phases
- [ ] Budget vs actuals tracking

## Completed
- [x] Scaffold Next.js 15 app with TypeScript + Tailwind dark theme
- [x] Create Supabase schema (7 tables across 3 migrations)
- [x] Build vault storage layer (markdown read/write with frontmatter)
- [x] Seed data for 4 project templates (SaaS, Ministry, PMBOK, Custom)
- [x] Project list page with stats aggregation
- [x] Project detail page with Board/Tasks/Risks tabs
- [x] AI chat panel with OpenAI integration + project context
- [x] Report generation (weekly rollup, blocker scan, hub, decisions)
- [x] All API routes (seed, chat, reports, phase clone, GitHub export)
- [x] Organizations and members as first-class entities
- [x] New project form with org/owner dropdowns
- [x] Switch from Anthropic SDK to OpenAI SDK
