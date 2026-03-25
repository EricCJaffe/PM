# ADR 0003 — Process Discovery & Automation Assessment Module

**Status:** Proposed
**Date:** 2026-03-23
**Decision Makers:** Eric Jaffe

---

## Context

The platform already has discovery infrastructure (gap analysis, discovery interviews, onboarding checklists). Clients need a structured way to **map their current processes per department**, identify **automation opportunities**, rank them, and decide which to pursue as projects. The module extends existing tables rather than creating new ones, and integrates with the client portal so departments can self-serve at their own pace.

## Design Decisions (from stakeholder input)

| # | Question | Decision |
|---|----------|----------|
| 1 | New tables or extend existing? | **Extend** existing discovery/gap tables |
| 2 | Process dependency scope | Start within same department; identify cross-department dependencies when they exist |
| 3 | Process structure | Both per-process AND per-department views. Multiple processes per department (minimum 1) |
| 4 | Automation scoring scale | 1–5 scale |
| 5 | Client interaction model | Client portal — departments populate and mark complete at their own pace. Admins see % complete per department |
| 6 | Process ownership | Per department (can also be a single user) |
| 7 | ROI analysis | Include full ROI (time saved, error reduction, cost savings, etc.) but note: meaningful only with cost basis data |
| 9 | Tech recommendations | Vendor-neutral with a lean toward Claude Code for implementation |
| 10 | Opportunities field | **Standalone ranked list** of all automation opportunities across the entire org. Independently sortable, clients choose which to pursue. Selected opportunities become individual projects |
| 11 | Reports | All available report types (summary, per-department, cross-org, ROI) |
| 12 | Branding | Per-org branding guide (via existing `getBranding()`) |
| 14 | SOW terminology | Use **"proposal"** (not SOW) — consistent with existing system |
| 15 | Approval workflow | **Formal sign-off** required before opportunities become projects |

---

## Architecture

### New Tables (extending existing schema)

#### `pm_processes` — Process Mapping
Individual business processes documented during discovery.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| org_id | uuid FK | Organization |
| project_id | uuid FK | Discovery/onboarding project |
| department_id | uuid FK | Owning department |
| engagement_id | uuid FK | Linked engagement |
| title | text | Process name |
| description | text | What this process does |
| category | text | vision, people, data, processes, meetings, issues, other |
| current_state | text | How it works today (narrative) |
| pain_points | text | What's broken / inefficient |
| frequency | text | daily, weekly, monthly, quarterly, ad-hoc |
| estimated_time_minutes | int | Time spent per occurrence |
| participants | text[] | Roles/people involved |
| tools_used | text[] | Current tools/systems |
| inputs | text | What triggers / feeds this process |
| outputs | text | What this process produces |
| dependencies | jsonb | `[{process_id, department_id, type: "upstream"|"downstream", description}]` |
| status | text | `not-started | in-progress | documented | reviewed | signed-off` |
| documented_by | text | Who documented it |
| reviewed_by | text | Who reviewed / approved |
| reviewed_at | timestamptz | |
| sort_order | int | Display ordering within department |
| created_at / updated_at | timestamptz | |

#### `pm_automation_opportunities` — Ranked Opportunity List
Standalone list of all identified automation possibilities across the org.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| org_id | uuid FK | |
| project_id | uuid FK | Discovery project |
| process_id | uuid FK | Source process (nullable — can be cross-process) |
| department_id | uuid FK | Primary department |
| engagement_id | uuid FK | |
| title | text | Opportunity name |
| description | text | What could be automated |
| current_pain | text | Problem being solved |
| proposed_solution | text | How automation would work |
| tech_recommendation | text | Vendor-neutral recommendation (lean Claude Code) |
| automation_score | int | 1–5 (feasibility + impact composite) |
| feasibility_score | int | 1–5 |
| impact_score | int | 1–5 |
| priority_rank | int | Global rank across org (client-adjustable) |
| estimated_time_saved_hours | decimal | Per week/month |
| estimated_cost_savings | decimal | Per month (requires cost basis) |
| estimated_error_reduction_pct | decimal | % improvement |
| estimated_implementation_hours | decimal | Build effort |
| cost_basis_notes | text | What cost data is known/needed |
| roi_notes | text | Qualitative ROI narrative |
| status | text | `identified | ranked | client-approved | declined | in-progress | implemented` |
| client_decision | text | `pending | approved | declined | deferred` |
| client_decision_at | timestamptz | |
| client_decision_by | text | |
| resulting_project_id | uuid FK | Project created when approved |
| cross_department | boolean | Spans multiple departments |
| related_departments | uuid[] | Other affected departments |
| sort_order | int | Manual sort within ranked list |
| created_at / updated_at | timestamptz | |

#### `pm_process_sign_offs` — Formal Sign-Off Records
Tracks formal approval of process documentation and automation decisions.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| org_id | uuid FK | |
| sign_off_type | text | `process-review | department-complete | automation-selection | final-approval` |
| reference_id | uuid | Process, department, or project ID |
| reference_type | text | `process | department | project | opportunity` |
| signed_by | text | Name of signer |
| signed_at | timestamptz | |
| signature_method | text | `portal-click | email-confirmation | in-person` |
| notes | text | |
| created_at | timestamptz | |

### Extended Tables

#### `pm_departments` — Add completion tracking
- `process_count` int DEFAULT 0
- `processes_documented` int DEFAULT 0
- `completion_pct` decimal GENERATED (processes_documented / NULLIF(process_count, 0) * 100)

#### `pm_gap_analysis` — Link to processes
- `process_id` uuid FK → pm_processes

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/pm/processes` | GET, POST | List / create processes (by org, department, project) |
| `/api/pm/processes/[id]` | GET, PATCH, DELETE | Process CRUD |
| `/api/pm/processes/[id]/sign-off` | POST | Formal sign-off on process documentation |
| `/api/pm/opportunities` | GET, POST | List / create automation opportunities |
| `/api/pm/opportunities/[id]` | GET, PATCH, DELETE | Opportunity CRUD |
| `/api/pm/opportunities/rank` | POST | Reorder opportunity rankings |
| `/api/pm/opportunities/[id]/approve` | POST | Client approves → creates project |
| `/api/pm/opportunities/[id]/decline` | POST | Client declines opportunity |
| `/api/pm/opportunities/report` | GET | Generate opportunity report (per-dept, cross-org, ROI) |
| `/api/pm/sign-offs` | GET, POST | List / record sign-offs |
| `/api/pm/departments/[id]/progress` | GET | Department completion % and status |

### Portal Integration

Client portal gets new tabs/sections:
- **Process Review** — view documented processes per department, mark as reviewed
- **Automation Opportunities** — see ranked list, approve/decline/defer each
- **Progress Dashboard** — % complete per department, overall progress
- **Sign-Off** — formal approval actions with audit trail

Each department works at its own pace. Admin dashboard shows:
- Per-department completion percentage
- Overall org progress
- Outstanding sign-offs
- Pending client decisions on opportunities

### Reports

All reports use `getBranding(orgId)` for per-org styling:

1. **Process Summary** — per department, all documented processes
2. **Department Progress** — completion %, outstanding items
3. **Automation Opportunities Report** — ranked list with ROI, scores, recommendations
4. **Cross-Org Overview** — all departments, all opportunities, aggregate stats
5. **ROI Analysis** — estimated savings (with cost basis caveats)
6. **Sign-Off Status** — audit trail of all approvals

### Workflow

```
1. Create discovery/onboarding project
2. Identify departments (existing department management)
3. Per department: document processes (min 1, client can self-serve via portal)
4. Identify automation opportunities per process
5. Opportunities aggregated into org-wide ranked list
6. Client reviews & ranks opportunities
7. Formal sign-off on process documentation per department
8. Client approves/declines each opportunity
9. Approved opportunities → individual projects (via proposal workflow)
10. Final sign-off on selections
```

### Component Architecture

```
src/components/
├── processes/
│   ├── ProcessTable.tsx          — List processes per department
│   ├── ProcessForm.tsx           — Add/edit process modal
│   ├── ProcessDetail.tsx         — Full process view
│   └── ProcessDependencyMap.tsx  — Visual dependency chart
├── opportunities/
│   ├── OpportunityList.tsx       — Ranked, drag-sortable list
│   ├── OpportunityCard.tsx       — Individual opportunity with scores
│   ├── OpportunityForm.tsx       — Add/edit modal
│   ├── OpportunityReport.tsx     — Printable report view
│   └── ROISummary.tsx            — ROI breakdown component
├── dashboard/
│   ├── ProcessDiscoveryTab.tsx   — Main dashboard tab
│   └── DepartmentProgress.tsx    — Per-dept completion bars
└── portal/
    ├── PortalProcessReview.tsx   — Client-facing process review
    ├── PortalOpportunities.tsx   — Client approve/decline UI
    └── PortalSignOff.tsx         — Formal sign-off interface
```

---

## Implementation Phases

### Phase 1: Schema & Core CRUD
- Migration: `pm_processes`, `pm_automation_opportunities`, `pm_process_sign_offs`
- Extend `pm_departments` with completion tracking
- API routes for processes and opportunities
- TypeScript types

### Phase 2: Dashboard UI
- ProcessDiscoveryTab on org dashboard
- ProcessTable + ProcessForm
- OpportunityList + OpportunityCard + OpportunityForm
- DepartmentProgress component

### Phase 3: Opportunity Ranking & ROI
- Drag-to-reorder ranked list
- ROI calculator fields
- Scoring (feasibility × impact)
- Opportunity report generation

### Phase 4: Portal Integration
- Client-facing process review
- Opportunity approve/decline/defer
- Department self-service documentation
- Progress tracking per department

### Phase 5: Sign-Off & Project Creation
- Formal sign-off workflow
- Approved opportunity → project creation (via proposal)
- Sign-off audit trail
- Final approval flow

### Phase 6: Reports & AI
- AI-generated process summaries
- Cross-org automation report
- ROI analysis with cost basis caveats
- Department progress reports
- Branded PDF/HTML export

---

## Open Questions
- Should process documentation support file attachments (screenshots, flowcharts)?
- Should AI auto-suggest automation opportunities from documented processes?
- What's the minimum viable portal experience for Phase 4?
