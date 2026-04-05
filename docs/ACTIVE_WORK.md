# ACTIVE_WORK.md — Live Work Status

> Claude reads this at every session start.
> Update when you start and end every session.
> Prevents two people directing Claude to touch the same thing at the same time.

---

## Current sprint
**Dates:** 2026-04-04 →
**Goal:** Security hardening pass (SEC-001–006) — SEC-001/002/003 done, SEC-004/005/006 in backlog + end-to-end workflow/portal testing

---

## Active now

| Developer | Branch | Area / Module | Key files being touched | Status | Updated |
|---|---|---|---|---|---|
| eric | main | Security / API | api-keys, site-audit routes, SECURITY.md | In Progress | 2026-04-04 |
| david | — | — | — | Available | — |

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
| SEC-004: full mitigation (server-side session storage) | Board decision — requires new DB schema + UI changes | @eric | 2026-04-04 |
| SEC-005: full rate limiting on AI endpoints | Board decision on thresholds + Upstash Redis infra (FSA-32) | @eric | 2026-04-04 |
| Test portal end-to-end | Needs live client invite + magic link test | @eric | 2026-04-04 |

---

## Waiting on review
| Branch | Developer | PR link | Reviewer | Opened |
|---|---|---|---|---|
| — | — | — | — | — |
