# SESSION-CHANGELOG.md — Per-Session Log

> Claude appends an entry at the end of every session where code changed.
> Newest entries at the top.

---

## Template
```
## [YYYY-MM-DD] — [one-line summary]

### Added
- [what was built or created]

### Changed
- [what was modified]

### Fixed
- [what was repaired]

### Decisions
- [non-obvious choices — link to DECISIONS/ if warranted]

### Open / carried forward
- [what was left open or blocked]

### Files changed
- [key files touched]
```

---

<!-- Entries below — newest first -->
## 2026-03-25 — Fix project chat task creation and remove duplicate AI bar

### Added
- `CODEX.md` startup guide for project-specific Codex session bootstrapping

### Changed
- Simplified the project detail page to use a single AI assistant surface
- Updated closeout documentation to reflect the branch, review state, and handoff

### Fixed
- AI chat task creation on project pages now resolves and sends the required `org_id`
- Confirmed the production failure mode was a `pm_tasks.org_id` not-null violation, not a phase-assignment bug

### Decisions
- Keep the main chat assistant on the project page and remove the redundant NLP quick-command bar there
- Preserve `/api/pm/nlp` for now in case other views still depend on it

### Open / carried forward
- Merge and deploy `fix/chat-task-org-id`
- Review whether other AI entry points should be consolidated around one interaction model

### Files changed
- `src/app/api/pm/chat/route.ts`
- `src/app/projects/[slug]/page.tsx`
- `CODEX.md`
- `docs/TASKS.md`
- `docs/ACTIVE_WORK.md`
- `docs/HANDOFF.md`
- `docs/SESSION-CHANGELOG.md`
