# TEAM.md — Who Owns What

> Claude reads this every session. Update when ownership or team changes.

---

## Team roster

| Handle | Name | Role | Type | Primary areas |
|---|---|---|---|---|
| eric | Eric Jaffe | Lead / Architect | Dir | Strategy, product decisions, client relationships |
| david | David | Collaborator | Dir | Discovery, requirements, client context, review |
| — | (open) | — | — | — |

**Role types:**
- Dir — prompt director, process expert, QA — does not push code directly
- Dev — writes code, manages branches (in this project: Claude Code)

---

## Module ownership

| Module | Owner | Notes |
|---|---|---|
| Auth and RLS | eric | Shared with FSA — coordinate before schema changes |
| Database schema / migrations | eric | Review all migrations before running |
| API routes /api/pm/ | eric | All routes reviewed by eric; implemented by Claude Code |
| Vault storage (src/lib/vault.ts) | eric | Shared by all features — coordinate before changes |
| AI features (chat, reports, docgen) | eric | GPT-4o via OpenAI SDK; prompts owned by eric |
| Document generation | eric | SOW, NDA, MSA — templates owned by eric |
| DocuSeal integration | eric | eSign flow; production-ready as of 2026-04-03 |
| Engagement engine | eric | Stage-change automation; auto-creates web passes |
| External API (/api/pm/ext/) | eric | API key auth; used by AI agent integrations |
| Frontend components | eric | React/Tailwind; reviewed by eric before merge |
| Deployment / Vercel | eric | Auto-deploys on push to main |

---

## Critical coordination rules

**Shared Supabase instance:** This project shares auth.users with FSA.
Never run a migration that touches auth.* without coordinating with FSA repo.

**Migration numbering:** Always use the next sequential number.
Current highest: 051 (check `supabase/migrations/` before creating a new one).

**RLS:** All 20 PM tables have RLS enabled (migration 014).
Any new table must include RLS policies in the same migration file.

---

## Non-developer guide

If you are directing Claude Code but not writing code:
- Read docs/HANDOFF.md plain-language summary after each session
- Read docs/TASKS.md for work status
- Add requests to TASKS.md as P0/P1/P2 with your name and date
- Check "Blockers needing input" in HANDOFF.md daily
