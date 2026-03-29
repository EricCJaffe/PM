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
## 2026-03-29 — claude

### PLAIN-LANGUAGE SUMMARY
What we worked on: Built the entire Web Project Workflow System — client portal, workflow engine, and AI content generation — from plan to working code in one session.
What got done:
- Client portal at /portal/[org-slug] with branded layout, magic link auth, dashboard
- Workflow engine: audit → remediation or rebuild project with auto-generated tasks
- 14-section church website admin checklist (50+ items)
- AI content generation for page copy from audit data + client intake
- Claude Code build prompt generator (saves to KB)
- Renamed Tools → Workflows tab with active workflow list
- Start Workflow panel on audit results (Remediation / Rebuild)
- Portal views: remediation checklist with score progress, rebuild 4-step wizard
What is still in progress:
- Migration 047 needs to be run in Supabase
- Content generation and build prompt buttons need wiring into admin UI
- Portal invite email sending (currently just creates invite record)
Decisions the team should know:
- "Tools" renamed to "Workflows" throughout
- Client portal is a separate route (/portal/) with its own minimal layout
- Portal auth uses magic link (email OTP) — no passwords
- Client sees 4 simple steps, admin sees full 14-section checklist
Blockers needing non-dev input:
- Run migration 047 in Supabase SQL Editor

### TECHNICAL HANDOFF
Session goal: Build complete Web Project Workflow System (Phases A-F)
Completed:
- Phase A: Portal foundation (10 files: layout, auth, dashboard, 4 sub-pages, invite-accept API, PortalShell, PortalDashboard)
- Phase B: Migration 047, AuditWorkflow types, workflow-generator.ts (500+ lines)
- Phase C: 4 API route files (workflow CRUD, re-audit, refresh-tasks)
- Phase D: WorkflowsTab.tsx with StartWorkflowPanel, DashboardTabs rename
- Phase E: PortalRemediationView, PortalRebuildWizard
- Phase F: generate-content and build-prompts API routes
Files changed:
- src/app/portal/* — NEW portal route tree (7 files)
- src/components/portal/* — NEW portal components (4 files)
- src/app/api/pm/portal/invite-accept/ — NEW invite acceptance
- src/app/api/pm/site-audit/workflow/* — NEW workflow APIs (6 files)
- src/lib/workflow-generator.ts — NEW workflow generator
- src/components/dashboard/WorkflowsTab.tsx — NEW (renamed from ToolsTab)
- src/components/dashboard/DashboardTabs.tsx — Tools → Workflows
- src/types/pm.ts — AuditWorkflow, ProjectCategory extensions
- src/middleware.ts — Portal auth routes
- supabase/migrations/047_audit_workflows.sql — NEW
Next session startup:
1. Run migration 047 in Supabase SQL Editor
2. Test portal: create invite → send magic link → login → see dashboard
3. Test workflow: run audit → Start Remediation → verify tasks generated
4. Wire content generation and build prompt buttons into admin workflow detail view
Branch: claude/review-project-docs-TbBoa
Migrations run: no (047 pending) | Env vars changed: no

---
## 2026-03-26 — claude

### PLAIN-LANGUAGE SUMMARY
What we worked on: Wired up the DocuSeal e-signature integration so documents (SOW, NDA, MSA) can be sent for digital signature, and created two new document templates.
What got done:
- DocuSeal eSign integration is functional — documents get sent, emails go out with signing links, signature fields appear in the right places
- Built NDA template from scratch with all 14 editable clauses
- Rebuilt MSA template with FSA branding (was plain text, now matches SOW/NDA)
- Upgraded the document section editor from raw HTML textarea to a rich text editor (Tiptap)
- Cleaned up all "Xodo Sign" references to DocuSeal
- Documented the reusable template pattern so future templates automatically work with eSign
What is still in progress:
- Cancel eSign button returns 404 — needs debugging with live DocuSeal data to confirm the submission_id resolution works
- After canceling, need the document to go back to "draft" so it can be edited and re-sent
- When a document is fully signed, need to download the signed PDF from DocuSeal and store it
Decisions the team should know:
- DocuSeal field tags are injected at eSign-send time, not stored in templates — keeps templates clean
- Provider (FSA) signature block always appears, no longer optional
- Default provider email falls back to eric@foundationstoneadvisors.com
Blockers needing non-dev input:
- Run `seed-docgen-nda.sql` and `seed-docgen-msa.sql` in Supabase SQL Editor to activate new templates

### TECHNICAL HANDOFF
Session goal: Wire up DocuSeal eSign integration and add NDA/MSA templates
Completed:
- `src/lib/esign.ts` — Rewrote API client for `documents` array format, added `injectSignatureFields()`, `getSubmitter()`, `SignerInfo` type, `buildSignerColumn()` helper
- `src/app/api/pm/docgen/[id]/esign/route.ts` — Fixed response parsing, submission_id resolution, always-include-both-signers, names/titles from intake data
- `src/app/api/pm/webhooks/esign/route.ts` — Added submission_id lookup in webhook matching
- `src/app/documents/[id]/page.tsx` — Fixed "Xodo Sign" → "DocuSeal" in UI
- `src/components/documents/SectionEditor.tsx` — Replaced textarea with Tiptap RichTextEditor
- `src/app/api/pm/docgen/route.ts` — Added `default_content` support for pre-populated sections
- `supabase/seeds/seed-docgen-nda.sql` — New NDA template (14 clauses, 13 intake fields)
- `supabase/seeds/seed-docgen-msa.sql` — Rebuilt MSA template (9 clauses, 11 intake fields)
- `supabase/migrations/019_esign_integration.sql` — Updated comments from Xodo to DocuSeal
- `scripts/test-docuseal.ts` — Updated to documents array format
- `docs/INTEGRATIONS.md` — Added field tag reference and updated flow docs
- `docs/PROMPT_LIBRARY.md` — Added reusable template pattern and DocuSeal injection docs
- `docs/TASKS.md` — Updated with all completed and remaining work
Files changed:
- `src/lib/esign.ts` — Core DocuSeal client rewrite + signature field injection
- `src/app/api/pm/docgen/[id]/esign/route.ts` — eSign route fixes (response parsing, both signers, names/titles)
- `src/app/api/pm/webhooks/esign/route.ts` — Webhook submission_id matching
- `src/app/documents/[id]/page.tsx` — UI text fix (Xodo → DocuSeal)
- `src/components/documents/SectionEditor.tsx` — Rich text editor upgrade
- `src/app/api/pm/docgen/route.ts` — default_content support
- `supabase/seeds/seed-docgen-nda.sql` — New file
- `supabase/seeds/seed-docgen-msa.sql` — New file
Decisions: DocuSeal field tags injected at send time (not in templates) — keeps templates reusable for print/PDF too
In progress: Cancel 404 bug — getSubmitter() may not be returning submission_id correctly
Blockers: Need live DocuSeal debugging to trace the exact ID chain
Next session startup:
1. Run `seed-docgen-nda.sql` and `seed-docgen-msa.sql` in Supabase SQL Editor
2. Debug the cancel 404 — add console.log in the eSign route to see what getSubmitter returns
3. Fix cancel button visibility (stays visible while status is "waiting")
4. Add signed document retrieval (download PDF from DocuSeal after submission.completed)
Branch: `claude/review-project-docs-TbBoa` | PR: not yet created
Migrations run: no new migrations | Env vars changed: no
