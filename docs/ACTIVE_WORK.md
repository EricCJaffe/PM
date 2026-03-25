# ACTIVE_WORK.md — Live Work Status

> Claude reads this at every session start.
> Update when you start and end every session.
> Prevents two people directing Claude to touch the same thing at the same time.

---

## Current sprint
**Dates:** [YYYY-MM-DD] to [YYYY-MM-DD]
**Goal:** [one sentence describing sprint focus]

---

## Active now

| Developer | Branch | Area / Module | Key files being touched | Status | Updated |
|---|---|---|---|---|---|
| eric | fix/chat-task-org-id | AI chat + project page UI | `src/app/api/pm/chat/route.ts`, `src/app/projects/[slug]/page.tsx`, closeout docs | Review | 2026-03-25 |
| [dev2] | — | — | — | Available | [date] |
| [dev3] | — | — | — | Available | [date] |

Status options: Active / In Progress / Blocked / Review / Available / WIP-Incomplete

---

## Files currently claimed
| File / Path | Developer | Branch | Since |
|---|---|---|---|
| — | — | — | — |

**Critical shared files — always check before touching:**
- supabase/migrations/* — coordinate with eric before any new migration
- src/lib/vault.ts — shared by all features
- src/lib/queries.ts — shared by all features
- src/types/pm.ts — shared types
- src/lib/supabase/server.ts and client.ts

---

## Blocked items
| Item | Blocked by | Owner | Opened |
|---|---|---|---|
| — | — | — | — |

---

## Waiting on review
| Branch | Developer | PR link | Reviewer | Opened |
|---|---|---|---|---|
| fix/chat-task-org-id | eric | https://github.com/EricCJaffe/PM/pull/new/fix/chat-task-org-id | eric | 2026-03-25 |
