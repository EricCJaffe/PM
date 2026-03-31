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
## 2026-03-30 — claude

### PLAIN-LANGUAGE SUMMARY
What we worked on: Merged main, added Guided Rebuild as third workflow type, made guided rebuild dynamic (add/remove pages, sub-pages, image upload, phase unlock).
What got done:
- Merged 27 commits from main into our branch (full 5-pass web design workflow was built in another session)
- Three workflow types: Remediation, Website Rebuild, Guided Rebuild — with existing workflow detection
- Dynamic page management: unlimited pages + sub-pages in content forms
- Image upload per page in the guided rebuild content editor
- Phase unlock: admin can re-open approved phases to make changes (colors, pages, content)
- Custom page input on Foundation pass (not limited to preset list)
- Build performance: skip TS/ESLint on Vercel builds, gzip, tree-shaking
What is still in progress:
- Content generation and build prompt buttons not yet wired into admin workflow detail view
- Portal invite email sending not yet functional
- DocuSeal cancel/re-send flow still has 404 bug
Decisions the team should know:
- Tab structure finalized: 8 tabs (Details, Projects, Workflows, Proposals, Notes, Docs, Branding, Client Portal)
- Guided Rebuild and Website Rebuild are separate workflow types (not aliases)
- Migration 047 applied + constraint updated for guided_rebuild
Blockers needing non-dev input: None

### TECHNICAL HANDOFF
Session goal: Merge main, add guided rebuild enhancements
Completed:
- Merged origin/main (27 commits) with conflict resolution
- Added `guided_rebuild` to WorkflowType, DB constraint, workflow API
- Rewrote ContentForm: dynamic PageNode tree, sub-pages, image upload, remove pages
- Updated PassStepper: onUnlockPass prop, pencil icon on approved passes
- Updated WebPassTab: unlockPass function, custom page input on Foundation pass
- Updated StartWorkflowPanel: fetches existing workflows, shows Continue vs Start
- Performance: next.config.ts optimizations
Files changed:
- src/components/web-passes/ContentForm.tsx — Full rewrite with dynamic pages
- src/components/web-passes/PassStepper.tsx — Unlock button + onUnlockPass
- src/components/web-passes/WebPassTab.tsx — unlockPass, custom page input
- src/components/dashboard/WorkflowsTab.tsx — 3 workflow types, existing detection
- src/types/pm.ts — guided_rebuild type
- src/app/api/pm/site-audit/workflow/route.ts — guided_rebuild support
- src/lib/workflow-generator.ts — guided_rebuild routing
- next.config.ts — Build + runtime optimizations
- supabase/migrations/047_audit_workflows.sql — guided_rebuild constraint
Next session startup:
1. Test guided rebuild: create workflow → add custom pages → upload image → approve → unlock → edit
2. Wire content generation + build prompt buttons into admin workflow detail
3. Fix DocuSeal cancel 404 bug
Branch: claude/review-project-docs-TbBoa | Merged to main
Migrations run: 047 applied + constraint updated | Env vars changed: no

---
## 2026-03-29 — claude

### PLAIN-LANGUAGE SUMMARY
What we worked on: Built the entire 5-pass website build workflow end-to-end — the guided process that takes a client from discovery audit through to a live deployed website with before/after scoring.
What got done:
- 5-pass workflow (discovery → foundation → content → polish → go-live) fully operational with GPT-4o mockup generation, quality gate scoring, section-level client comments, and go-live deployment
- Public client review portal at /web-review/[token] — clients can select layout options and leave section feedback with no login
- Client portal page at /portal/[slug] — the public-facing project status page for clients (was returning "page not found")
- Engagement engine auto-creates a website-build project + 5 passes when a website_build engagement moves to closed_won
- Stage-triggered task templates fire automatically when a deal changes stages
- All migrations 047–050 applied and complete
Decisions the team should know:
- Scoring gate blocks polish pass approval until all 4 dimensions pass their thresholds (SEO≥70, Conversion≥70, AI Discoverability≥60, Content≥60)
- Before/after comparison is built at deploy time from the discovery audit (linked to pass 0) and the final audit (provided on deploy)
- Engagement engine deduplicates: if passes already exist for an org it won't create duplicates
Blockers needing non-dev input:
- None

### TECHNICAL HANDOFF
Session goal: Complete 5-pass workflow, engagement engine, scoring gate, go-live automation, and client portal page
Completed:
- `supabase/migrations/047_web_passes.sql` — pm_web_passes + pm_web_pass_comments tables (inlined updated_at trigger)
- `supabase/migrations/048_website_build_template.sql` — website-build template via pure SQL upsert (5 phases, 23 tasks)
- `supabase/migrations/049_engagements_website_build.sql` — website_url, owner, notes on pm_engagements; dropped old CHECK constraint
- `supabase/migrations/050_engagement_task_template_service_line.sql` — service_line column + 12 website_build task templates seeded
- `src/lib/engagement-engine.ts` — onEngagementStageChange, spawnStageTasks, autoCreateWebProject
- `src/app/api/pm/engagements/route.ts` + `[id]/route.ts` — full engagement CRUD with engine hook on PATCH
- `src/app/api/pm/web-passes/[id]/score/route.ts` — GPT-4o quality gate scorer
- `src/app/api/pm/web-passes/[id]/reject/route.ts` — reject pass with reason
- `src/app/api/pm/web-passes/[id]/deploy/route.ts` — go-live: approve, complete project, build before/after comparison
- `src/components/web-passes/ContentForm.tsx` — Pass 2 page-by-page content editor
- `src/components/web-passes/ScoringGate.tsx` — Quality gate UI with dimension scores
- `src/components/web-passes/BeforeAfterReport.tsx` — Before/after audit comparison renderer
- `src/components/web-passes/WebPassTab.tsx` — Full workflow UI with GoLivePanel
- `src/app/web-review/[token]/page.tsx` — Public client review portal (no login)
- `src/app/portal/[slug]/page.tsx` — Client portal server component (fixed "page not found")
- `src/types/pm.ts` — Added website_build to EngagementServiceLine, Pass2PageContent, Pass2FormData types
- `src/components/dashboard/ToolsTab.tsx` — Wired "Guided Rebuild (5-Pass)" card into WebPassTab
- `CLAUDE.md` — Added all new tables, routes, and project templates
- `docs/TASKS.md`, `docs/SUPABASE.md`, `docs/API.md`, `docs/HANDOFF.md` — Updated
Files changed: All files listed above
Decisions: Service role client used throughout (no auth on public web-review and portal pages); pass deduplication by org; trigger inlined to avoid missing shared function
In progress: Nothing — all phases complete
Blockers: None
Next session startup:
1. `git pull origin main`
2. Review docs/TASKS.md for any pending backlog items
3. Check if DocuSeal cancel/re-send flow needs to be tackled next
Branch: main | Commits: 04d2d60, 5a2af5c, 7cc1dea, 6ad84e2, cb6b1a2 | PR: merged
Migrations run: yes — 047, 048, 049, 050
Env vars changed: no

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
- Fixed project chat `add_task` path to derive `org_id` from `pm_projects` in src/app/api/pm/chat/route.ts
- Removed `NLPCommandBar` from src/app/projects/[slug]/page.tsx
- Added startup instructions in CODEX.md
Files changed:
- src/app/api/pm/chat/route.ts — populate `org_id` for chat-created tasks
- src/app/projects/[slug]/page.tsx — remove duplicate NLP bar from project detail page
Decisions: Keep the conversational assistant as the only AI input on project detail pages.
In progress: PR/merge not yet completed.
Blockers: None.
Branch: fix/chat-task-org-id | Migrations run: no | Env vars changed: no
