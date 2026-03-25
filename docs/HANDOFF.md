# HANDOFF.md — Session Closeout Notes

> Claude generates this automatically at session end.
> Say "Close out session" and Claude writes both sections.
> Newest entries at the top.

---

## How to trigger
Say: **"Close out session"**
Claude writes the plain-language summary, technical handoff, and PM update block.
No manual writing required.

---

## Entry format

```
---
## [YYYY-MM-DD] [HH:MM] — [handle]

### PLAIN-LANGUAGE SUMMARY
What we worked on: [1-3 sentences, no jargon]
What got done:
- [item]
What is still in progress:
- [item — current state]
Decisions the team should know:
- [any direction change]
Blockers needing non-dev input:
- [specific ask or "None"]

### TECHNICAL HANDOFF
Session goal: [intent]
Completed:
- [item with file reference]
Files changed:
- [path] — [what and why]
Decisions: [decision — rationale]
In progress: [item — exact state]
Blockers: [blocker — what resolves it]
Next session startup:
1. [first step]
2. [second step]
Branch: [name] | Commit: [message] | PR: [status]
Migrations run: [yes — list / no]
Env vars changed: [yes — list / no]
```

---

<!-- Entries below — newest first -->
---
## 2026-03-25 17:10 — eric

### PLAIN-LANGUAGE SUMMARY
What we worked on: Fixed the AI assistant on the project page so it can create tasks again, and removed the second smaller AI command box that was duplicating the main assistant. The issue was not phase setup; the task insert was failing because the chat route did not send the required organization ID.
What got done:
- Fixed AI chat task creation on project pages by resolving the project `org_id` before inserting tasks
- Verified the live Supabase failure mode and confirmed the corrected insert shape works
- Removed the redundant NLP command bar from the project detail page
- Added a repo-specific `CODEX.md` startup guide for future sessions
What is still in progress:
- Branch is pushed and ready for review or merge
Decisions the team should know:
- Keep one primary AI surface on the project page; do not show both chat and the NLP quick-command bar there
- Leave `/api/pm/nlp` intact for other parts of the product unless a separate consolidation pass is requested
Blockers needing non-dev input:
- None

### TECHNICAL HANDOFF
Session goal: Diagnose and fix project-page AI task creation, then simplify the duplicate AI UI and close out the day.
Completed:
- Fixed project chat `add_task` path to derive `org_id` from `pm_projects` in [src/app/api/pm/chat/route.ts](/Users/ericjaffe/PM/src/app/api/pm/chat/route.ts)
- Removed `NLPCommandBar` from [src/app/projects/[slug]/page.tsx](/Users/ericjaffe/PM/src/app/projects/[slug]/page.tsx)
- Added startup instructions in [CODEX.md](/Users/ericjaffe/PM/CODEX.md)
- Updated [docs/TASKS.md](/Users/ericjaffe/PM/docs/TASKS.md), [docs/ACTIVE_WORK.md](/Users/ericjaffe/PM/docs/ACTIVE_WORK.md), and [docs/SESSION-CHANGELOG.md](/Users/ericjaffe/PM/docs/SESSION-CHANGELOG.md)
Files changed:
- [src/app/api/pm/chat/route.ts](/Users/ericjaffe/PM/src/app/api/pm/chat/route.ts) — populate `org_id` for chat-created tasks
- [src/app/projects/[slug]/page.tsx](/Users/ericjaffe/PM/src/app/projects/[slug]/page.tsx) — remove duplicate NLP bar from project detail page
- [CODEX.md](/Users/ericjaffe/PM/CODEX.md) — project-specific Codex startup routine
- [docs/TASKS.md](/Users/ericjaffe/PM/docs/TASKS.md) — log the AI task fix and UI cleanup
- [docs/ACTIVE_WORK.md](/Users/ericjaffe/PM/docs/ACTIVE_WORK.md) — mark branch/review state
- [docs/SESSION-CHANGELOG.md](/Users/ericjaffe/PM/docs/SESSION-CHANGELOG.md) — session summary
Decisions: Keep the conversational assistant as the only AI input on project detail pages because the NLP quick bar is functionally redundant there and creates UI confusion.
In progress: PR/merge not yet completed.
Blockers: None.
Next session startup:
1. Merge `fix/chat-task-org-id` after review and confirm deployment on Vercel.
2. Decide whether to consolidate or retire remaining `/api/pm/nlp` entry points outside the project page.
Branch: fix/chat-task-org-id | Commit: pending closeout commit | PR: https://github.com/EricCJaffe/PM/pull/new/fix/chat-task-org-id
Migrations run: no
Env vars changed: no
