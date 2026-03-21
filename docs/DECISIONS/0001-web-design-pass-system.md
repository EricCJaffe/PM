# ADR 0001 — Web Design Pass System Architecture

**Status:** Proposed
**Date:** 2026-03-21
**Context:** Build a multi-pass web design workflow conforming to the BusinessOS PM model.

---

## Decision

### Data Model: Hybrid (Phases + Dedicated Pass Table)

**Project phases** handle task management and progress tracking (reuse existing PM infrastructure).
**`pm_web_passes`** stores pass-specific structured data (form inputs, rendered HTML, section comments, approval gates).
**`pm_web_pass_comments`** stores section-by-section client feedback on mockup/preview deliverables.

### Entry Point: New Service Line + Project Template

- Add `website_build` to `EngagementServiceLine` type
- Create `website-build` project template with 5 phases: Discovery, Pass 1, Pass 2, Pass 3, Go-Live
- Engagement task templates auto-spawn tasks per pass when project is created
- Each pass phase has pre-defined tasks (team tasks for Pass 1, client tasks for Pass 2, AI+human tasks for Pass 3)

### Client Review: Dual Access (Share Link + Portal)

- Public share URL (token-based, no login) for quick mockup review + section comments
- Portal login for ongoing access — same comment data, richer context
- Comments merge into `pm_web_pass_comments` regardless of access method

### Mockup System: Extend `audit-mockup.ts`

- Add `generateWebMockup()` to existing `audit-mockup.ts`
- Parameterized by Pass 1 form data (brand colors, logo, vertical, pages, service times)
- Generates 2 style variants (Option A / Option B)
- Pass 2 re-renders with real client content
- Pass 3 applies AI changes from comments + adds SEO/schema

---

## Implementation Plan

### Phase 1: Database Migration (migration 037)

New tables:

```sql
-- Pass-specific data for web design projects
CREATE TABLE pm_web_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES pm_phases(id) ON DELETE SET NULL,
  pass_number INT NOT NULL CHECK (pass_number BETWEEN 0 AND 4),
  -- 0=discovery, 1=pass1, 2=pass2, 3=pass3, 4=go-live
  pass_type TEXT NOT NULL CHECK (pass_type IN (
    'discovery', 'foundation', 'content', 'polish', 'go-live'
  )),
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN (
    'locked', 'active', 'in-review', 'approved', 'rejected'
  )),
  form_data JSONB DEFAULT '{}',
  deliverable_html TEXT,           -- rendered mockup/preview HTML
  deliverable_html_b TEXT,         -- second option (Pass 1 only)
  selected_option TEXT CHECK (selected_option IN ('a', 'b')),
  share_token TEXT UNIQUE,         -- public review URL token
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  scoring_results JSONB,           -- Pass 3 scoring gate results
  site_audit_id UUID REFERENCES pm_site_audits(id),  -- link to discovery audit
  final_audit_id UUID REFERENCES pm_site_audits(id), -- link to go-live audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, pass_number)
);

-- Section-by-section client comments on mockup deliverables
CREATE TABLE pm_web_pass_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id UUID NOT NULL REFERENCES pm_web_passes(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,          -- e.g. 'hero', 'about', 'services', 'footer'
  section_label TEXT,                -- display name
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'approve', 'comment', 'request-change'
  )),
  comment TEXT,
  commenter_name TEXT,
  commenter_email TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  ai_applied BOOLEAN DEFAULT false,  -- true when AI auto-applied this feedback
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add website_build columns to pm_engagements
ALTER TABLE pm_engagements
  ADD COLUMN IF NOT EXISTS web_pass_project_id UUID REFERENCES pm_projects(id);

-- Indexes
CREATE INDEX idx_web_passes_project ON pm_web_passes(project_id);
CREATE INDEX idx_web_passes_share_token ON pm_web_passes(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_web_pass_comments_pass ON pm_web_pass_comments(pass_id);
CREATE INDEX idx_web_pass_comments_section ON pm_web_pass_comments(pass_id, section_id);

-- RLS
ALTER TABLE pm_web_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_web_pass_comments ENABLE ROW LEVEL SECURITY;

-- Internal users: full access
CREATE POLICY web_passes_internal_read ON pm_web_passes FOR SELECT USING (pm_is_internal());
CREATE POLICY web_passes_internal_write ON pm_web_passes FOR ALL USING (pm_is_internal_write());
-- External users: read via project org access
CREATE POLICY web_passes_external_read ON pm_web_passes FOR SELECT USING (
  pm_has_project_access(project_id)
);
-- Public comments via share token handled at API level (no auth required)

CREATE POLICY web_pass_comments_internal_read ON pm_web_pass_comments FOR SELECT USING (pm_is_internal());
CREATE POLICY web_pass_comments_internal_write ON pm_web_pass_comments FOR ALL USING (pm_is_internal_write());
```

### Phase 2: TypeScript Types (src/types/pm.ts)

```typescript
// Web Design Pass System
export type WebPassType = 'discovery' | 'foundation' | 'content' | 'polish' | 'go-live';
export type WebPassStatus = 'locked' | 'active' | 'in-review' | 'approved' | 'rejected';
export type WebPassFeedbackType = 'approve' | 'comment' | 'request-change';

export interface WebPass {
  id: string;
  project_id: string;
  phase_id: string | null;
  pass_number: number;
  pass_type: WebPassType;
  status: WebPassStatus;
  form_data: Record<string, unknown>;
  deliverable_html: string | null;
  deliverable_html_b: string | null;
  selected_option: 'a' | 'b' | null;
  share_token: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  scoring_results: ScoringGateResults | null;
  site_audit_id: string | null;
  final_audit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebPassComment {
  id: string;
  pass_id: string;
  section_id: string;
  section_label: string | null;
  feedback_type: WebPassFeedbackType;
  comment: string | null;
  commenter_name: string | null;
  commenter_email: string | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  ai_applied: boolean;
  created_at: string;
}

export interface ScoringGateResults {
  seo_score: number;
  conversion_score: number;
  ai_discoverability_score: number;
  content_score: number;
  entity_score: number;
  a2a_score: number;
  overall_score: number;
  overall_grade: string;
  passes_gate: boolean;
  gate_failures: string[];  // which dimensions failed minimums
}

// Pass 1 Form Data shape
export interface Pass1FormData {
  vertical: string;          // church, agency, nonprofit, general
  brand_colors: { primary: string; secondary: string; accent: string };
  logo_url: string | null;
  business_name: string;
  tagline: string;
  pages: string[];           // ['home', 'about', 'services', 'contact', ...]
  service_times?: string;    // church-specific
  service_descriptions?: Record<string, string>;
  target_audience: string;
  tone: string;              // professional, warm, bold, minimal
  reference_sites?: string[];
}

// Pass 2 Form Data shape (page-by-page content)
export interface Pass2FormData {
  pages: Record<string, Pass2PageContent>;
}

export interface Pass2PageContent {
  page_slug: string;
  page_title: string;
  sections: Pass2Section[];
}

export interface Pass2Section {
  section_id: string;
  section_label: string;
  content: string;           // client-written or AI-generated
  ai_generated: boolean;
  photos: string[];          // storage paths or 'stock' marker
  photo_preference: 'uploaded' | 'stock' | 'none';
}

// Extend EngagementServiceLine
// Add 'website_build' to the union type
```

### Phase 3: Project Template + Engagement Task Templates

**Website Build template** (`website-build`):

| Phase | Name | Tasks |
|---|---|---|
| 0 | Discovery | Run site audit, Review audit results, Discuss findings with client |
| 1 | Pass 1 — Foundation & Look | Fill Pass 1 form, Generate mockups, Send for client review, Collect feedback, Approve Pass 1 |
| 2 | Pass 2 — Content Population | Unlock client content form, Monitor content completion, Generate AI content (on request), Re-render preview, Client review, Approve Pass 2 |
| 3 | Pass 3 — Polish & QA | AI-apply Pass 2 comments, Human review AI changes, Client uploads final photos, Wire SEO + schema + llms.txt, Run scoring rubric, Compare vs discovery audit, Team final approval |
| 4 | Go-Live | Deploy to Vercel, Generate before/after PDF, Mark project complete |

**Engagement task templates** for `website_build` service line:
- Stage `qualified`: Create website-build project, Schedule kickoff
- Stage `discovery_complete`: Review audit results, Prepare Pass 1 form
- Stage `closed_won`: Begin Pass 1, Send client portal invite

### Phase 4: API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/pm/web-passes` | GET | List passes for a project (by project_id) |
| `/api/pm/web-passes/[id]` | GET, PATCH | View / update pass (form_data, status) |
| `/api/pm/web-passes/[id]/generate` | POST | Generate mockup HTML from form_data (Pass 1: 2 options, Pass 2: content render, Pass 3: AI polish) |
| `/api/pm/web-passes/[id]/approve` | POST | Team approves pass → unlocks next pass |
| `/api/pm/web-passes/[id]/reject` | POST | Team rejects pass with reason → back to active |
| `/api/pm/web-passes/[id]/score` | POST | Run scoring rubric against built site (Pass 3 gate) |
| `/api/pm/web-passes/[id]/deploy` | POST | Trigger Vercel deployment (Go-Live) |
| `/api/pm/web-passes/share/[token]` | GET, POST | Public mockup review page + submit section comments |
| `/api/pm/web-passes/[id]/comments` | GET, POST, DELETE | Section comments CRUD (internal) |
| `/api/pm/web-passes/[id]/comments/apply` | POST | AI reads all unresolved comments → applies to HTML |
| `/api/pm/web-passes/[id]/compare` | GET | Before/after audit comparison (discovery vs final) |

### Phase 5: Extend audit-mockup.ts

Current `generateMockupHtml()` takes `vertical + siteName + fetchedContent`.

Extend with:
```typescript
export async function generateWebMockup(
  formData: Pass1FormData,
  options: {
    variant: 'a' | 'b';
    contentOverrides?: Pass2FormData;  // Pass 2+
    commentFixes?: WebPassComment[];    // Pass 3
  }
): Promise<string>
```

- Pass 1: Generate 2 distinct styled HTML mockups using form data (brand colors, pages, tone) with stock photos + placeholder content
- Pass 2: Re-render selected option with real client content from Pass2FormData
- Pass 3: Apply comment fixes, wire SEO meta, schema markup, llms.txt

### Phase 6: UI Components

| Component | Purpose |
|---|---|
| `WebPassWizard.tsx` | Multi-step form for Pass 1 (brand, pages, tone) — client-facing |
| `ContentForm.tsx` | Page-by-page content editor for Pass 2 — client-facing |
| `MockupReview.tsx` | Rendered mockup with section overlay + comment sidebar — used in portal + share page |
| `PassStepper.tsx` | Visual pass progression (Discovery → P1 → P2 → P3 → Go-Live) with status indicators |
| `ScoringGate.tsx` | Pass 3 scoring dashboard with min thresholds + pass/fail |
| `BeforeAfterReport.tsx` | Side-by-side audit comparison (discovery vs go-live) |
| `WebPassTab.tsx` | Tab on project detail page showing pass status, forms, and deliverables |

### Phase 7: Public Share Pages

| Route | Purpose |
|---|---|
| `/web-review/[token]` | Public mockup review — rendered HTML + section comment forms |
| Reuse proposal share pattern | Token lookup → render mockup → POST comments |

### Phase 8: Engagement Engine Extension

Update `engagement-engine.ts`:
- When `website_build` engagement enters `closed_won`, auto-create website-build project with all 5 phases + `pm_web_passes` rows
- Discovery pass auto-links to any existing `pm_site_audits` for that org
- Pass 0 (discovery) auto-set to `active`, passes 1-4 set to `locked`

### Phase 9: Scoring Gate Logic

Reuse existing audit rubric scoring but apply to the *built* site (not existing site):
- Minimum thresholds: SEO ≥ 70, Conversion ≥ 70, AI Discoverability ≥ 60
- If discovery audit exists: generate side-by-side comparison
- Gate must pass before go-live phase can be approved
- Store results in `pm_web_passes.scoring_results`

### Phase 10: Go-Live Automation

- Deploy to Vercel via API (requires `VERCEL_TOKEN` + `VERCEL_TEAM_ID` env vars)
- Run final site audit on deployed URL → store as `final_audit_id`
- Generate before/after PDF using existing audit PDF route
- Mark project as `complete`
- Update engagement stage if linked

---

## Implementation Order

1. Migration 037 (tables + RLS)
2. TypeScript types
3. Query functions in `queries.ts`
4. Project template seed (`website-build`)
5. Engagement task templates seed
6. API routes (web-passes CRUD, generate, approve, comments, share, score, compare)
7. Extend `audit-mockup.ts` with `generateWebMockup()`
8. Engagement engine extension
9. UI components (PassStepper, WebPassTab, WebPassWizard, ContentForm, MockupReview)
10. Public share page (`/web-review/[token]`)
11. Scoring gate + before/after comparison
12. Go-live automation (Vercel deploy + final audit + PDF)
13. Seed engagement task templates for website_build
14. Update docs (TASKS.md, SUPABASE.md, API.md)

---

## Files to Create/Modify

### New Files
- `supabase/migrations/037_web_passes.sql`
- `src/app/api/pm/web-passes/route.ts`
- `src/app/api/pm/web-passes/[id]/route.ts`
- `src/app/api/pm/web-passes/[id]/generate/route.ts`
- `src/app/api/pm/web-passes/[id]/approve/route.ts`
- `src/app/api/pm/web-passes/[id]/reject/route.ts`
- `src/app/api/pm/web-passes/[id]/score/route.ts`
- `src/app/api/pm/web-passes/[id]/deploy/route.ts`
- `src/app/api/pm/web-passes/[id]/comments/route.ts`
- `src/app/api/pm/web-passes/[id]/comments/apply/route.ts`
- `src/app/api/pm/web-passes/[id]/compare/route.ts`
- `src/app/api/pm/web-passes/share/[token]/route.ts`
- `src/app/web-review/[token]/page.tsx`
- `src/components/web-passes/PassStepper.tsx`
- `src/components/web-passes/WebPassTab.tsx`
- `src/components/web-passes/WebPassWizard.tsx`
- `src/components/web-passes/ContentForm.tsx`
- `src/components/web-passes/MockupReview.tsx`
- `src/components/web-passes/ScoringGate.tsx`
- `src/components/web-passes/BeforeAfterReport.tsx`
- `supabase/seeds/seed-website-build-template.ts`

### Modified Files
- `src/types/pm.ts` — add WebPass types, extend EngagementServiceLine
- `src/lib/audit-mockup.ts` — add generateWebMockup()
- `src/lib/engagement-engine.ts` — website_build auto-project creation
- `src/lib/queries.ts` — getWebPasses, getWebPassComments, etc.
- `docs/TASKS.md` — add web pass tasks
- `docs/SUPABASE.md` — document new tables
- `CLAUDE.md` — add new tables and routes
