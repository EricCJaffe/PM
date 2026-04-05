# Process Analyzer Workflow — Implementation Plan

## The Problem

We have the pieces but not the pipeline. The SOP scanner finds opportunities. The ministry-discovery template defines phases. The gap analysis captures what's missing. But there's no connected workflow that:

1. Creates a project when "Process Analyzer" is selected
2. Discovers departments → creates intake forms per department
3. Scans existing docs → conforms them to our structure
4. Generates standardized playbook documents where none exist
5. Outputs a complete company playbook with automation recommendations
6. Has a client portal component so clients can self-serve parts of it

## Architecture: Process Analyzer as a Workflow

Just like the website rebuild workflow, the Process Analyzer becomes a **workflow type** that lives under the Workflows tab. It uses the existing `pm_audit_workflows` table (extended) and follows the same pattern: trigger → project creation → phased tasks → client portal views.

### Workflow Type: `process_discovery`

```
Trigger: Admin clicks "Process Analyzer" in Workflows tab
  → Creates pm_audit_workflows (workflow_type: 'process_discovery')
  → Creates project from ministry-discovery template (or business-discovery template)
  → System auto-creates department intake forms
  → Client portal shows per-department questionnaire
  → Admin reviews, AI enhances, produces playbook documents
```

---

## The 7-Stage Pipeline

Maps directly to the existing ministry-discovery template phases, but now each stage has specific system behaviors, forms, and outputs.

### Stage 1: Organizational Setup
**Phase:** P0 — Prayer & Commitment (church) / Engagement Setup (business)
**Admin does:** Creates the workflow, selects vertical (church/nonprofit/business), enters org basics
**System does:**
- Creates project with appropriate template
- Pulls org info from pm_organizations (name, contact, address)
- Creates department records in pm_departments from a starter list based on vertical:
  - **Church:** Operations, Communications, Finance, Volunteer Mgmt, Donor Relations, Programs & Ministry
  - **Business:** Operations, Sales, Marketing, Finance, HR, IT, Customer Service
  - **Nonprofit:** Operations, Programs, Development/Fundraising, Marketing, Finance, Volunteer Mgmt
- Each department gets a `pm_web_passes`-style intake form (or we reuse a simpler pattern)

**Client portal:** Welcome page with org overview, timeline, expectations

### Stage 2: Organizational Understanding
**Phase:** P1 — Organizational Understanding
**Admin does:** Conducts leadership interviews, maps org structure
**System does:**
- Pre-populates interview templates from discovery intake form questions (Layer 1-3)
- Creates pm_discovery_interviews for scheduled interviews
- Captures org chart, decision structures, communication flows

**Client portal:** Upload org chart, staff list, provide high-level org info form

### Stage 3: Current State Assessment
**Phase:** P2 — Current State Assessment
**Admin does:** Reviews existing docs, assesses process maturity
**System does:**
- Runs the SOP scanner on any uploaded client documents
- Auto-generates gap analysis items from scan results
- Creates process maturity scorecard (1-5 per pillar per department)
- Tool stack inventory captured

**Client portal:** Upload existing SOPs, process docs, manuals, handbooks. Simple upload + description per document.

### Stage 4: Department Deep Dive
**Phase:** P3 — Department Discovery (7-Layer Analysis)

**This is the core innovation.** For each department, the system creates a structured intake form based on the discovery intake questionnaire (DISCOVERY_INTAKE_BUSINESS.md or DISCOVERY_INTAKE_CHURCH.md). The form maps to the 7 layers:

1. Mission Alignment (→ Vision pillar)
2. Success Metrics (→ Data pillar)
3. People & Org (→ People pillar)
4. Communication (→ Meetings pillar)
5. Processes (→ Processes pillar)
6. Pain Points (→ Issues pillar)
7. Automation Opportunities (→ Processes + Data)

**Admin does:** Conducts interviews using the structured form, or assigns the form to the client/department head to self-complete in the portal
**System does:**
- Creates one intake form per department (dynamic, based on department type)
- As forms are completed, auto-generates:
  - Gap analysis items (pillar scores below threshold)
  - Process map entries (from Layer 5 answers)
  - KPI suggestions (from Layer 2 answers)
  - Automation opportunities (from Layer 7 answers)
- Tracks completion % per department
- AI can pre-fill answers from scanned SOPs

**Client portal:** Per-department questionnaire (the intake form). Department leads fill in their sections. Progress bar shows completion across departments.

### Stage 5: Playbook Generation
**Phase:** P4 — Quick Wins & P5 — Roadmap (combined for this workflow)

**This is where documents get produced.** For each department, the system generates a standardized playbook document using the document generation system (same as SOW/NDA).

**Admin does:** Reviews AI-generated playbook drafts, edits in Tiptap editor, finalizes
**System does:**
- For each department, generates a `generated_document` with document_type = "department-playbook"
- Playbook structure (sections):
  1. Department Overview (from Layer 1 answers)
  2. Organizational Chart & Roles (from Layer 3 answers)
  3. Key Metrics & Scorecard (from Layer 2 answers → KPI definitions)
  4. Meeting Rhythms & Communication (from Layer 4 answers)
  5. Core Processes & SOPs (from Layer 5 answers, enhanced by AI)
  6. Known Issues & Resolution Plan (from Layer 6 answers → gap analysis)
  7. Automation Opportunities (from Layer 7 answers, ranked by ROI)
  8. Action Plan & Quick Wins (prioritized list)
- AI drafts each section from the intake form answers + any scanned SOP content
- Sections are editable in the rich text editor (Tiptap)
- Admin can lock sections and regenerate others

**Client portal:** Review draft playbooks, leave comments, approve sections

### Stage 6: Review & Approval
**Phase:** P6 — Equip, Empower, Release

**Admin does:** Presents playbooks to department heads, collects sign-offs
**System does:**
- Tracks approval status per department playbook
- Generates master company playbook (compiled document with all department playbooks)
- Creates final automation opportunity ranking (org-wide, sorted by ROI)
- Generates implementation roadmap from approved opportunities

**Client portal:** Sign-off on department playbooks, review & rank automation opportunities, approve/decline each opportunity

### Stage 7: Implementation & Handoff
**Phase:** S1-S4 — Support Sections

**Admin does:** Trains champions, creates sustainability plan
**System does:**
- Approved automation opportunities → individual projects
- Training materials generated from playbook content
- Before/after metrics baseline captured
- Ongoing review cadence scheduled (recurring tasks)
- ROI tracking dashboard

**Client portal:** Access finalized playbooks, track implementation progress, view ROI metrics

---

## Database Changes

### Extend `pm_audit_workflows`
Add `process_discovery` to the workflow_type CHECK constraint (alongside remediation, rebuild, guided_rebuild).

### New: `pm_department_intake` table
Stores per-department questionnaire responses (the 7-layer intake form answers).

```sql
pm_department_intake (
  id               UUID PK DEFAULT gen_random_uuid(),
  workflow_id      UUID NOT NULL REFERENCES pm_audit_workflows(id),
  org_id           UUID NOT NULL REFERENCES pm_organizations(id),
  department_id    UUID NOT NULL REFERENCES pm_departments(id),
  status           TEXT DEFAULT 'not-started' CHECK (status IN ('not-started','in-progress','complete','reviewed','approved')),
  responses        JSONB DEFAULT '{}',   -- layer answers keyed by question_id
  pillar_scores    JSONB DEFAULT '{}',   -- {vision: 3, people: 2, data: 1, ...}
  ai_summary       TEXT,                 -- AI-generated department summary
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
)
```

### New: Document Type `department-playbook`
Seeded via `seed-docgen-playbook.sql` with:
- HTML template with FSA branding (same pattern as SOW/NDA/MSA)
- 8 sections (overview, org chart, metrics, meetings, processes, issues, automation, action plan)
- Intake fields auto-populated from department_intake responses
- Standard signature block for department head sign-off

### Extend `pm_departments`
Add columns for tracking progress:
```sql
ALTER TABLE pm_departments
  ADD COLUMN IF NOT EXISTS process_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processes_documented INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS playbook_document_id UUID REFERENCES generated_documents(id);
```

---

## What's Reused vs Net-New

### Fully Reused (no changes)
- `pm_audit_workflows` table (just add workflow_type value)
- Ministry-discovery template (project phases)
- SOP scanner (`/api/pm/scan-sop`) — scans uploaded docs
- Discovery interviews (`/api/pm/discovery-interviews`)
- Gap analysis (`/api/pm/gap-analysis`)
- Process maps (`/api/pm/process-maps`)
- Discovery assembler (`discovery-assembler.ts`)
- Document generation system (SOW pattern: intake fields → sections → compile)
- Client portal foundation (`/portal/[orgSlug]`)
- Tiptap rich text editor for section editing

### Extended
- `pm_audit_workflows` — add `process_discovery` type
- `pm_departments` — add process tracking columns
- WorkflowsTab — add "Process Analyzer" card alongside Site Audit
- Portal workflow page — add ProcessDiscoveryView for the portal side
- `workflow-generator.ts` — add `generateProcessDiscoveryPhases()`

### Net-New
- `pm_department_intake` table — per-department questionnaire responses
- `seed-docgen-playbook.sql` — department playbook document type
- `DepartmentIntakeForm.tsx` — the 7-layer questionnaire component (admin + portal)
- `PlaybookGenerator.ts` — maps intake responses → document sections
- `/api/pm/department-intake` — CRUD for intake forms
- `/api/pm/department-intake/[id]/generate-playbook` — AI generates playbook from responses
- `PortalProcessDiscoveryView.tsx` — client portal view for process discovery workflow

---

## Implementation Phases

### Phase 1: Foundation
- Extend workflow_type constraint for `process_discovery`
- Migration: `pm_department_intake` table
- Migration: `pm_departments` tracking columns
- TypeScript types for DepartmentIntake
- `generateProcessDiscoveryPhases()` in workflow-generator.ts
- "Process Analyzer" card in WorkflowsTab (creates workflow + project)

### Phase 2: Department Intake Forms
- `DepartmentIntakeForm.tsx` — the 7-layer questionnaire
  - Reads questions from DISCOVERY_INTAKE_BUSINESS.md / CHURCH.md structure
  - Per-layer sections with checkbox + text field questions
  - Auto-saves responses to pm_department_intake
  - Pillar scoring (1-5) auto-calculated from answers
- `/api/pm/department-intake` — CRUD routes
- Admin UI: assign departments, view completion progress
- Portal UI: department leads fill out their intake form

### Phase 3: SOP Scanning Integration
- When client uploads docs in Stage 3, auto-scan with existing SOP scanner
- Map scanned content to department intake form pre-fills
- AI suggests answers for Layer 5 (Processes) and Layer 7 (Automation) from scanned docs
- Gap analysis items auto-generated from scan findings

### Phase 4: Playbook Document Generation
- `seed-docgen-playbook.sql` — department playbook document type
- `PlaybookGenerator.ts` — maps intake responses → document sections
  - Layer 1 answers → "Department Overview" section
  - Layer 2 answers → "Key Metrics & Scorecard" section (+ auto-create KPIs)
  - Layer 3 answers → "Organizational Chart & Roles" section
  - Layer 4 answers → "Meeting Rhythms & Communication" section
  - Layer 5 answers → "Core Processes & SOPs" section
  - Layer 6 answers → "Known Issues & Resolution Plan" section
  - Layer 7 answers → "Automation Opportunities" section
  - Combined → "Action Plan & Quick Wins" section
- AI drafts each section, admin edits in Tiptap, client reviews
- Master playbook: compile all department playbooks into one document

### Phase 5: Client Portal Views
- `PortalProcessDiscoveryView.tsx` — stepped wizard:
  1. "About Your Organization" — org-level overview form
  2. "Department Discovery" — per-department intake forms with progress
  3. "Review Documents" — uploaded SOPs, scanned results
  4. "Review Playbooks" — department playbook drafts, comment & approve
  5. "Implementation Plan" — ranked automation opportunities, ROI
- Department head can be assigned specific departments to complete
- Progress dashboard showing overall completion %

### Phase 6: Sign-Off & Handoff
- Department playbook approval workflow (approve/reject per department)
- Master playbook compilation
- Automation opportunity ranking and client approval
- Approved opportunities → project creation
- Training materials generation from playbook content
- ROI tracking baseline capture

---

## How It Connects to Existing Workflows

```
Client Engagement Starts
  ├─ Site Audit → Remediation / Rebuild / Guided Rebuild workflow
  │              (website-focused)
  │
  └─ Process Analyzer → Process Discovery workflow
                         (operations-focused)
                         │
                         ├─ Per-department intake forms (portal)
                         ├─ SOP scanning (existing docs)
                         ├─ Gap analysis (auto-generated)
                         ├─ Playbook documents (AI-generated)
                         ├─ Automation opportunities (ranked)
                         └─ Implementation projects (from approved opportunities)
```

Both workflows can run in parallel for the same client. A church might get a website rebuild AND a process discovery simultaneously.

---

## Verification

1. Click "Process Analyzer" in Workflows tab → project created with ministry-discovery phases
2. Departments auto-created based on vertical
3. Navigate to department intake form → fill out 7-layer questionnaire
4. Upload SOPs → scanner runs, pre-fills intake answers
5. Complete all departments → generate playbook documents
6. Review playbooks in Tiptap editor, approve sections
7. Client sees portal with intake forms and playbook reviews
8. Approve playbooks → master playbook compiled
9. Rank automation opportunities → approve → projects created
