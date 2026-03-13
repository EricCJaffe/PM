# BusinessOS PM — Context

## Purpose
AI-first project management module for BusinessOS. Manages projects using markdown files as the canonical source of truth (vault), with Supabase as the queryable index.

**Philosophy:** *"Files as memory, AI as intelligence, UI as a window."*

## Platform Hierarchy
- **BusinessOS** — the parent platform
- **FSA** — Financial Services Automation (property intelligence) — separate repo
- **PM** — Project Management (this module) — shares Supabase backend with FSA

## Architecture
Dual-layer storage: every project entity exists in both Supabase DB (structured queries) and Supabase Storage (markdown vault with YAML frontmatter). Writes go to DB first, then sync to vault files.

## Current State (Phase 1)
- Next.js 15 app scaffolded with full dark-mode UI
- 7 Supabase tables + 3 migrations applied
- 4 project templates seeded (SaaS Rollout, Ministry Discovery, PMBOK, Custom)
- Organizations and members as first-class entities
- AI chat with OpenAI integration (gpt-4o)
- Report generation: weekly rollup, blocker scan, hub report, decision register
- Vault storage layer with full markdown generation
- GitHub export endpoint (pre-go-live vault sync)

## Phase 2 (Planned)
- Client portal with `org_viewer` role
- Auth integration (shared with FSA)
- RLS policies on all PM tables
- Supabase realtime subscriptions for live updates
