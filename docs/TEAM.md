# TEAM.md — Who Owns What

> Claude reads this every session. Update when ownership or team changes.

---

## Team roster

| Handle | Name | Role | Type | Primary areas |
|---|---|---|---|---|
| eric | Eric Jaffe | Lead / Architect | Dir | Strategy, product decisions, client relationships |
| [handle] | [Name] | [Role] | Dev/Dir | [fill in] |
| [handle] | [Name] | [Role] | Dev/Dir | [fill in] |

**Role types:**
- Dir — prompt director, process expert, QA — does not push code directly
- Dev — writes code, manages branches (in this project: Claude Code)

---

## Module ownership

| Module | Owner | Notes |
|---|---|---|
| Auth and RLS | eric | Shared with FSA — coordinate before schema changes |
| Database schema / migrations | eric | Review all migrations before running |
| API routes /api/pm/ | | |
| Vault storage (src/lib/vault.ts) | | |
| AI features (chat, reports, docgen) | | |
| Document generation | | |
| DocuSeal integration | | |
| Engagement engine | | |
| External API (/api/pm/ext/) | | |
| Frontend components | | |
| Deployment / Vercel | eric | |

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
