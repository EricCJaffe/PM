# BusinessOS PM — Context

## Purpose
AI-first project management module for BusinessOS. Manages client engagements, projects, documents, and website builds using a dual-layer storage architecture (Supabase DB + markdown vault), with GPT-4o as the intelligence layer.

**Philosophy:** *"Files as memory, AI as intelligence, UI as a window."*

## Platform Hierarchy
- **BusinessOS** — the parent platform
- **FSA** — Foundation Stone Advisors (primary agency tenant)
- **PM** — Project Management module (this repo) — shared Supabase backend

## Architecture
Dual-layer storage: every project entity exists in both Supabase DB (structured queries, RLS, dashboards) and Supabase Storage (markdown vault with YAML frontmatter). Writes go to DB first, then sync to vault files. Reads use DB for queries, Storage files for full content display and export.

## Current State
- **51 migrations applied** — full schema in production
- **Auth** — Supabase Auth with Microsoft Azure AD SSO; role-based access (admin/user/external); RLS on all PM tables
- **Orgs & Members** — multi-tenant with site org flag (FSA staff), org-scoped external users
- **Projects** — 5 templates (SaaS Rollout, Ministry Discovery, PMBOK, Website Build 5-Pass, Custom); intake wizard for web projects
- **AI Chat** — GPT-4o with full project context per project
- **Reports** — weekly rollup, blocker scan, hub report, decision register, daily standup (automated via Vercel Cron)
- **Document Generation** — SOW, NDA, MSA with AI content generation, rich text editing, DocuSeal eSign integration
- **Site Audits** — rubric-based scoring across 6 dimensions, PDF export, snapshots, AI comparison
- **5-Pass Website Build Workflow** — full client-facing build pipeline (Discovery → Foundation → Content → Polish → Go-Live) with GPT-4o mockup generation, scoring gate, public client review portal, go-live deployment
- **Engagements / CRM** — pipeline with deal stages, projected revenue, stage-triggered task automation, engagement engine auto-creates web projects on closed_won
- **Client Portal** — branded external portal at `/portal/[slug]` with magic link auth, portal settings, invite management
- **Recurring Tasks** — task series with recurrence rules, exception handling, daily Vercel Cron generation
- **Discovery & Onboarding** — gap analysis, discovery interviews, onboarding checklists, AI discovery brief generation
- **Branding** — centralized branding system with platform-level and per-org overrides, co-branding modes
- **Departments & Vocabulary** — org department management with flexible term overrides
- **Knowledge Base** — scoped KB articles (global/org/project) used as AI context
- **Vault** — Supabase Storage markdown files at `vault/[org-slug]/[project-slug]/...`

## Key Entry Points
| URL | Purpose |
|---|---|
| `/` | Landing / login |
| `/dashboard` | Admin dashboard |
| `/clients/[slug]` | Client detail (8 tabs) |
| `/portal/[slug]` | External client portal (no login) |
| `/web-review/[token]` | Public client mockup review |
| `/site-audit` | Standalone site audit runner |
| `/admin` | Admin console (users, branding, API keys) |

## Active Cron Jobs
| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/standup` | Weekdays 8am UTC | Auto-generate morning standup per org |
| `/api/cron/engagement-nudge` | Weekdays 9am UTC | Check overdue engagement tasks |
| `/api/cron/series-generate` | Daily midnight UTC | Generate recurring task instances (14-day horizon) |
