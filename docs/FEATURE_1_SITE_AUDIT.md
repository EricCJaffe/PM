# FEATURE_1_SITE_AUDIT.md
## Site Audit Tool — Complete Build Specification
## Hand this to Claude Code as the primary instruction document

---

## What you are building

A site audit tool inside the PM app. A team member opens any
`pm_engagement` record for a prospect, clicks "Run Site Audit",
enters their URL, selects a vertical, and gets back:

1. A scored gap analysis across 6 dimensions (A–F grades)
2. A list of quick wins and missing pages
3. A combined PDF — audit report + rebuilt site mock-up
4. A "Create Proposal" shortcut that pre-fills `pm_docgen`

The tool also works as a standalone page at `/site-audit`
for running audits without an existing engagement.

---

## Read these files before writing any code

```
CLAUDE.md
docs/CONTEXT.md
docs/SUPABASE.md          ← schema reference, migration numbering
docs/API.md               ← existing routes — follow these patterns exactly
docs/ENVIRONMENT.md       ← env vars already available
docs/seo/SCORING_INDEX.md        ← scoring system overview
docs/seo/SCORING_RUBRIC_CHURCH.md
docs/seo/SCORING_RUBRIC_AGENCY.md
docs/seo/SCORING_RUBRIC_NONPROFIT.md
docs/seo/AUDIT_PDF_SPEC.md       ← exact PDF design spec
src/app/api/pm/reports/rollup/route.ts   ← follow this AI generation pattern
src/app/api/pm/docgen/route.ts           ← follow this document creation pattern
src/lib/openai.ts                        ← always use getOpenAI(), never top-level
src/lib/supabase/server.ts               ← server-side Supabase client pattern
src/types/pm.ts                          ← add new types here
```

---

## Step 1 — Database migration

Check migration count first:
```bash
ls supabase/migrations/ | sort | tail -5
```

Create the next numbered migration. Current known highest is 019.
If your count is different, use YOUR next number.

```sql
-- supabase/migrations/020_site_audits.sql

-- Site audits table
create table pm_site_audits (
  id              uuid        default gen_random_uuid() primary key,
  org_id          uuid        references pm_organizations(id) on delete cascade not null,
  engagement_id   uuid        references pm_engagements(id) on delete set null,
  url             text        not null,
  vertical        text        not null check (vertical in ('church', 'agency', 'nonprofit')),
  status          text        not null default 'pending'
                              check (status in ('pending', 'running', 'complete', 'failed')),
  scores          jsonb       not null default '{}',
  gaps            jsonb       not null default '{}',
  quick_wins      jsonb                default '[]',
  pages_found     jsonb                default '[]',
  pages_missing   jsonb                default '[]',
  overall_grade   text,
  overall_score   integer,
  rebuild_recommended boolean default false,
  rebuild_reason  text,
  audit_html      text,
  mockup_html     text,
  pdf_storage_path text,
  error_message   text,
  created_by      uuid        references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- updated_at trigger (function already exists in schema)
create trigger pm_site_audits_updated_at
  before update on pm_site_audits
  for each row execute function update_updated_at_column();

-- RLS
alter table pm_site_audits enable row level security;

create policy "pm_site_audits_access" on pm_site_audits
  for all using (pm_has_org_access(org_id));

-- Index for engagement lookups
create index pm_site_audits_engagement_idx on pm_site_audits(engagement_id);
create index pm_site_audits_org_idx on pm_site_audits(org_id);
```

---

## Step 2 — TypeScript types

Add to `src/types/pm.ts`:

```typescript
export type SiteAuditVertical = 'church' | 'agency' | 'nonprofit'

export type SiteAuditStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface SiteAuditScore {
  grade: string        // e.g. "D", "C-", "F"
  score: number        // 0-100
  findings: string[]
  pages_found?: string[]   // content dimension only
  pages_missing?: string[] // content dimension only
}

export interface SiteAuditScores {
  seo: SiteAuditScore
  entity: SiteAuditScore
  ai_discoverability: SiteAuditScore
  conversion: SiteAuditScore
  content: SiteAuditScore
  a2a: SiteAuditScore
}

export interface SiteAuditQuickWin {
  action: string
  time_estimate: string
  impact: string
}

export interface SiteAudit {
  id: string
  org_id: string
  engagement_id: string | null
  url: string
  vertical: SiteAuditVertical
  status: SiteAuditStatus
  scores: SiteAuditScores
  gaps: Record<string, unknown>
  quick_wins: SiteAuditQuickWin[]
  pages_found: string[]
  pages_missing: string[]
  overall_grade: string | null
  overall_score: number | null
  rebuild_recommended: boolean
  rebuild_reason: string | null
  audit_html: string | null
  mockup_html: string | null
  pdf_storage_path: string | null
  error_message: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

---

## Step 3 — Rubric loader utility

Create `src/lib/audit-rubrics.ts`:

```typescript
import { SiteAuditVertical } from '@/types/pm'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load rubric markdown at runtime from docs/seo/
// These files are in the repo and available at build time
export function loadRubric(vertical: SiteAuditVertical): string {
  const filename = `SCORING_RUBRIC_${vertical.toUpperCase()}.md`
  const filePath = join(process.cwd(), 'docs', 'seo', filename)
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    // Fallback: inline the rubric summary if file not found
    return `Score across: SEO (20%), Entity Authority (15%), AI Discoverability (20%), Conversion (20%), Content (15%), A2A (10%). Grade: A=90+, B=80-89, C=70-79, D=60-69, F<60.`
  }
}

export function loadAuditSpec(): string {
  const filePath = join(process.cwd(), 'docs', 'seo', 'AUDIT_PDF_SPEC.md')
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}
```

---

## Step 4 — Site fetcher utility

Create `src/lib/site-fetcher.ts`:

```typescript
// Fetches a website and returns combined text content for AI scoring

export interface FetchedSiteContent {
  url: string
  title: string | null
  metaDescription: string | null
  h1: string | null
  bodyText: string
  pageCount: number
  additionalPages: string[]
  fetchError: string | null
}

const TIMEOUT_MS = 10000
const MAX_CONTENT_CHARS = 12000 // stay within GPT-4o context

export async function fetchSiteContent(url: string): Promise<FetchedSiteContent> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
  const baseUrl = new URL(normalizedUrl).origin

  let combinedText = ''
  let title: string | null = null
  let metaDescription: string | null = null
  let h1: string | null = null
  const additionalPages: string[] = []
  let fetchError: string | null = null

  // Pages to try fetching
  const pagesToFetch = [
    normalizedUrl,
    `${baseUrl}/about`,
    `${baseUrl}/contact`,
    `${baseUrl}/beliefs`,
    `${baseUrl}/visit`,
    `${baseUrl}/services`,
  ]

  let pageCount = 0

  for (const pageUrl of pagesToFetch) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const response = await fetch(pageUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditBot/1.0)' },
      })
      clearTimeout(timeout)

      if (!response.ok) continue

      const html = await response.text()
      const extracted = extractTextFromHtml(html, pageUrl === normalizedUrl)

      if (pageUrl === normalizedUrl) {
        title = extracted.title
        metaDescription = extracted.metaDescription
        h1 = extracted.h1
        combinedText += `\n\n=== HOME PAGE (${pageUrl}) ===\n${extracted.bodyText}`
      } else {
        combinedText += `\n\n=== PAGE: ${pageUrl} ===\n${extracted.bodyText}`
        additionalPages.push(pageUrl)
      }

      pageCount++

      if (combinedText.length > MAX_CONTENT_CHARS) break
    } catch {
      if (pageUrl === normalizedUrl) {
        fetchError = `Could not fetch ${pageUrl}`
      }
      // Silently skip additional pages that fail
    }
  }

  return {
    url: normalizedUrl,
    title,
    metaDescription,
    h1,
    bodyText: combinedText.slice(0, MAX_CONTENT_CHARS),
    pageCount,
    additionalPages,
    fetchError,
  }
}

function extractTextFromHtml(html: string, isHome: boolean) {
  // Simple extraction without DOM parser (edge runtime compatible)
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null
  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? null
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ?? null

  // Strip scripts, styles, nav, footer for cleaner text
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)

  return { title, metaDescription, h1, bodyText: cleaned }
}
```

---

## Step 5 — API routes

### POST /api/pm/site-audit/route.ts

Create `src/app/api/pm/site-audit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAI } from '@/lib/openai'
import { fetchSiteContent } from '@/lib/site-fetcher'
import { loadRubric } from '@/lib/audit-rubrics'
import { SiteAuditVertical } from '@/types/pm'
import { z } from 'zod'

const CreateAuditSchema = z.object({
  url: z.string().min(1),
  vertical: z.enum(['church', 'agency', 'nonprofit']),
  org_id: z.string().uuid(),
  engagement_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateAuditSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { url, vertical, org_id, engagement_id } = parsed.data

  // Create pending audit record
  const { data: audit, error: createError } = await supabase
    .from('pm_site_audits')
    .insert({
      org_id,
      engagement_id: engagement_id ?? null,
      url,
      vertical,
      status: 'running',
      created_by: user.id,
    })
    .select()
    .single()

  if (createError || !audit) {
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Run audit async — return audit ID immediately so UI can poll
  runAudit(audit.id, url, vertical, supabase).catch(console.error)

  return NextResponse.json({ audit_id: audit.id, status: 'running' }, { status: 202 })
}

async function runAudit(
  auditId: string,
  url: string,
  vertical: SiteAuditVertical,
  supabase: ReturnType<typeof createClient>
) {
  try {
    // 1. Fetch site content
    const siteContent = await fetchSiteContent(url)

    if (siteContent.fetchError) {
      await supabase.from('pm_site_audits').update({
        status: 'failed',
        error_message: siteContent.fetchError,
      }).eq('id', auditId)
      return
    }

    // 2. Load rubric
    const rubric = loadRubric(vertical)

    // 3. Score with GPT-4o
    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a website audit specialist. Score websites against the provided rubric. Return only valid JSON.`,
        },
        {
          role: 'user',
          content: buildScoringPrompt(url, vertical, siteContent, rubric),
        },
      ],
      max_tokens: 2000,
    })

    const rawResult = completion.choices[0]?.message?.content
    if (!rawResult) throw new Error('No response from GPT-4o')

    const result = JSON.parse(rawResult)

    // 4. Generate mock-up HTML
    const mockupHtml = generateMockupHtml(url, vertical, result, siteContent)

    // 5. Update audit record with results
    await supabase.from('pm_site_audits').update({
      status: 'complete',
      scores: result.scores ?? {},
      gaps: result.gaps ?? {},
      quick_wins: result.quick_wins ?? [],
      pages_found: result.scores?.content?.pages_found ?? [],
      pages_missing: result.scores?.content?.pages_missing ?? [],
      overall_grade: result.overall_grade ?? null,
      overall_score: result.overall_score ?? null,
      rebuild_recommended: result.rebuild_recommended ?? false,
      rebuild_reason: result.rebuild_reason ?? null,
      mockup_html: mockupHtml,
    }).eq('id', auditId)

  } catch (err) {
    await supabase.from('pm_site_audits').update({
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Unknown error',
    }).eq('id', auditId)
  }
}

function buildScoringPrompt(
  url: string,
  vertical: SiteAuditVertical,
  siteContent: ReturnType<typeof fetchSiteContent> extends Promise<infer T> ? T : never,
  rubric: string
): string {
  return `
Score this ${vertical} website against the rubric below.

URL: ${url}
Title: ${siteContent.title ?? 'Not found'}
Meta description: ${siteContent.metaDescription ?? 'Not found'}
H1: ${siteContent.h1 ?? 'Not found'}
Pages fetched: ${siteContent.pageCount}

WEBSITE CONTENT:
${siteContent.bodyText}

SCORING RUBRIC:
${rubric}

Return ONLY valid JSON matching exactly this structure:
{
  "scores": {
    "seo": { "grade": "D", "score": 62, "findings": ["finding 1", "finding 2"] },
    "entity": { "grade": "C-", "score": 68, "findings": [] },
    "ai_discoverability": { "grade": "F", "score": 28, "findings": [] },
    "conversion": { "grade": "D+", "score": 65, "findings": [] },
    "content": {
      "grade": "D", "score": 60, "findings": [],
      "pages_found": ["/", "/about", "/events"],
      "pages_missing": ["/visit", "/beliefs", "/sermons", "/ministries"]
    },
    "a2a": { "grade": "F", "score": 15, "findings": [] }
  },
  "overall_score": 53,
  "overall_grade": "D",
  "quick_wins": [
    { "action": "Add service times above the fold", "time_estimate": "30 min", "impact": "Immediate conversion improvement" }
  ],
  "rebuild_recommended": true,
  "rebuild_reason": "Overall grade D with F on AI discoverability and A2A"
}

Rules:
- Be conservative — only give full credit when criterion is clearly met
- Grade thresholds: A=90+, B=80-89, C=70-79, D=60-69, F=below 60
- Include 2-4 specific findings per dimension
- Include 3-5 quick wins maximum
`
}

function generateMockupHtml(
  url: string,
  vertical: SiteAuditVertical,
  scores: Record<string, unknown>,
  siteContent: ReturnType<typeof fetchSiteContent> extends Promise<infer T> ? T : never,
): string {
  // Returns the rebuilt site mockup HTML
  // This is a simplified version — expand based on AUDIT_PDF_SPEC.md
  const orgName = siteContent.title?.replace(/\s*[|\-–—].*/, '').trim() ?? url
  const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Georgia', serif; background: #faf9f6; width: 900px; margin: 0 auto; }
nav { background: #1c2b1e; padding: 14px 40px; display: flex; justify-content: space-between; align-items: center; }
.nav-logo { font-size: 18px; color: #e8dfc8; letter-spacing: .04em; }
.nav-cta { background: #c4793a; color: #fff; border: none; padding: 8px 18px; border-radius: 5px; font-size: 12px; }
.hero { background: #1c2b1e; padding: 60px 40px 50px; }
.hero-eyebrow { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #c4793a; margin-bottom: 14px; font-family: sans-serif; }
.hero-title { font-size: 44px; color: #f0ebe0; line-height: 1.1; max-width: 520px; margin-bottom: 18px; }
.hero-title em { color: #c4793a; font-style: italic; }
.hero-sub { color: #9aaa90; font-size: 14px; line-height: 1.8; max-width: 420px; margin-bottom: 30px; font-family: sans-serif; font-weight: 300; }
.btn-primary { background: #c4793a; color: #fff; padding: 12px 24px; border-radius: 7px; font-size: 14px; text-decoration: none; display: inline-block; margin-right: 10px; font-family: sans-serif; }
.btn-outline { border: 1.5px solid #4a6048; color: #9aaa90; padding: 11px 24px; border-radius: 7px; font-size: 14px; text-decoration: none; display: inline-block; font-family: sans-serif; }
.section { padding: 54px 40px; }
.section-label { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #c4793a; margin-bottom: 6px; font-family: sans-serif; }
.section-title { font-size: 30px; color: #1c2b1e; margin-bottom: 14px; line-height: 1.2; }
.visit-section { background: #f5f0e8; }
footer { background: #111d12; padding: 36px 40px 20px; }
.footer-logo { font-size: 16px; color: #e8dfc8; margin-bottom: 8px; }
.footer-copy { font-size: 11px; color: #2e4030; }
</style>
</head>
<body>
<nav>
  <div class="nav-logo">${orgName}</div>
  <button class="nav-cta">Plan Your Visit</button>
</nav>
<div class="hero">
  <p class="hero-eyebrow">Rebuilt site concept — ${domain}</p>
  <h1 class="hero-title">A place where <em>lives are changed</em></h1>
  <p class="hero-sub">A community rooted in faith, hope, and genuine care for people.</p>
  <div style="margin-bottom:40px">
    <a href="#" class="btn-primary">Plan Your First Visit</a>
    <a href="#" class="btn-outline">Watch a Message</a>
  </div>
</div>
<div class="section visit-section">
  <p class="section-label">First time here?</p>
  <h2 class="section-title">We would love to meet you</h2>
  <p style="color:#5a6854;font-family:sans-serif;font-size:14px;line-height:1.8;max-width:560px">Visiting for the first time can feel like a big step. Here is everything you need to feel right at home before you arrive.</p>
</div>
<footer>
  <p class="footer-logo">${orgName}</p>
  <p class="footer-copy">© ${new Date().getFullYear()} ${orgName}</p>
</footer>
</body>
</html>
`
}

// GET — list audits for an org
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) {
    return NextResponse.json({ error: 'org_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('pm_site_audits')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### GET /api/pm/site-audit/[id]/route.ts

Create `src/app/api/pm/site-audit/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('pm_site_audits')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('pm_site_audits')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
```

### POST /api/pm/site-audit/[id]/pdf/route.ts

```typescript
// PDF generation using Puppeteer
// Install: npm install puppeteer-core @sparticuz/chromium

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { generateAuditReportHtml } from '@/lib/audit-pdf-generator'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Load audit
  const { data: audit, error } = await supabase
    .from('pm_site_audits')
    .select('*, pm_organizations(name, slug)')
    .eq('id', params.id)
    .single()

  if (error || !audit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (audit.status !== 'complete') {
    return NextResponse.json({ error: 'Audit not complete' }, { status: 400 })
  }

  // Generate combined HTML (audit + mockup)
  const auditHtml = generateAuditReportHtml(audit)
  const combinedHtml = auditHtml + (audit.mockup_html ?? '')

  // Render to PDF via Puppeteer
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  })

  const page = await browser.newPage()
  await page.setContent(combinedHtml, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true })
  await browser.close()

  // Store in Supabase Storage
  const orgSlug = (audit as Record<string, unknown> & { pm_organizations?: { slug: string } }).pm_organizations?.slug ?? 'unknown'
  const storagePath = `${orgSlug}/audits/${audit.id}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Update audit record
  await supabase
    .from('pm_site_audits')
    .update({ pdf_storage_path: storagePath })
    .eq('id', audit.id)

  // Return signed URL for download
  const { data: signedUrl } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600) // 1 hour

  return NextResponse.json({ pdf_url: signedUrl?.signedUrl, storage_path: storagePath })
}
```

---

## Step 6 — PDF HTML generator

Create `src/lib/audit-pdf-generator.ts`:

This file generates the audit report HTML that Puppeteer renders to PDF.
It follows the design spec in `docs/seo/AUDIT_PDF_SPEC.md` exactly.

```typescript
import { SiteAudit, SiteAuditScores } from '@/types/pm'

export function generateAuditReportHtml(audit: SiteAudit & { pm_organizations?: { name: string } }): string {
  const orgName = audit.pm_organizations?.name ?? new URL(audit.url.startsWith('http') ? audit.url : `https://${audit.url}`).hostname
  const domain = new URL(audit.url.startsWith('http') ? audit.url : `https://${audit.url}`).hostname
  const date = new Date(audit.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const scores = audit.scores as SiteAuditScores

  const gradeColor = (grade: string) => {
    if (!grade) return '#888'
    if (grade.startsWith('A')) return '#1e8449'
    if (grade.startsWith('B')) return '#1e8449'
    if (grade.startsWith('C')) return '#d68910'
    return '#c0392b'
  }

  const dimensionRows = (items: Array<[string, string, string, string]>) =>
    items.map(([item, current, standard, gap]) => `
      <tr>
        <td style="padding:7px 10px;font-size:9px;color:#1a1a1a;font-family:Helvetica,sans-serif">${item}</td>
        <td style="padding:7px 10px;font-size:9px;color:#4a5e4c;font-family:Helvetica,sans-serif">${current}</td>
        <td style="padding:7px 10px;font-size:9px;color:#4a5e4c;font-family:Helvetica,sans-serif">${standard}</td>
        <td style="padding:7px 10px;font-size:9px;color:#4a5e4c;font-family:Helvetica,sans-serif">${gap}</td>
      </tr>
    `).join('')

  const sectionHeader = (num: number, title: string) => `
    <div style="background:#1c2b1e;border-radius:6px;padding:10px 14px;margin:20px 0 12px">
      <span style="font-size:13px;font-weight:bold;color:#fff;font-family:Helvetica,sans-serif">${num} · ${title}</span>
    </div>
  `

  const tableHeader = (cols: string[]) => `
    <tr style="background:#2e4030">
      ${cols.map(c => `<th style="padding:7px 10px;font-size:9px;color:#fff;font-family:Helvetica,sans-serif;text-align:left;font-weight:bold">${c}</th>`).join('')}
    </tr>
  `

  const scoreTable = `
    <table style="width:100%;border-collapse:collapse;border-radius:6px;overflow:hidden;margin-bottom:20px">
      ${tableHeader(['Category', 'Grade', 'Key Finding'])}
      ${[
        ['SEO', scores?.seo],
        ['Entity Authority', scores?.entity],
        ['AI Discoverability', scores?.ai_discoverability],
        ['Conversion', scores?.conversion],
        ['Content', scores?.content],
        ['A2A Readiness', scores?.a2a],
      ].map(([label, s], i) => {
        const sc = s as SiteAuditScore
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f5f3ee'}">
          <td style="padding:7px 10px;font-size:9px;font-weight:bold;font-family:Helvetica,sans-serif">${label}</td>
          <td style="padding:7px 10px;font-size:11px;font-weight:bold;color:${gradeColor(sc?.grade ?? '')};text-align:center;font-family:Helvetica,sans-serif">${sc?.grade ?? '?'}</td>
          <td style="padding:7px 10px;font-size:9px;color:#4a5e4c;font-family:Helvetica,sans-serif">${sc?.findings?.[0] ?? 'No findings'}</td>
        </tr>`
      }).join('')}
    </table>
  `

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  @page { size: letter; margin: 0; }
  body { margin: 0; padding: 0; font-family: Helvetica, sans-serif; background: #faf9f6; }
  .page { padding: 56px 0.5in 44px; min-height: 11in; position: relative; }
  .page-header { position: fixed; top: 0; left: 0; right: 0; height: 44px; background: #1c2b1e; display: flex; align-items: center; justify-content: space-between; padding: 0 0.5in; z-index: 100; }
  .page-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 30px; background: #f5f0e8; display: flex; align-items: center; justify-content: space-between; padding: 0 0.5in; }
  table { border-collapse: collapse; width: 100%; }
  .callout { background: #f5e6d8; border-left: 3px solid #c4793a; padding: 10px 14px; border-radius: 0 4px 4px 0; margin: 12px 0; }
</style>
</head>
<body>

<div class="page-header">
  <span style="font-size:10px;font-weight:bold;color:#e8dfc8">${orgName} — Site Audit Report</span>
  <span style="font-size:9px;color:#7a9070">Prepared ${date}</span>
</div>
<div style="height:2px;background:#c4793a;position:fixed;top:44px;left:0;right:0;z-index:101"></div>

<div class="page-footer">
  <span style="font-size:8px;color:#7a8874">Confidential — Prepared for internal use and client presentation</span>
</div>

<div class="page" style="background:#1c2b1e;text-align:center;padding-top:120px">
  <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c4793a;margin-bottom:14px">WEBSITE AUDIT REPORT</p>
  <h1 style="font-size:38px;color:#f0ebe0;margin-bottom:10px">${orgName}</h1>
  <p style="font-size:22px;color:#9aaa90;margin-bottom:16px">${domain}</p>
  <p style="font-size:11px;color:#7a9070;margin-bottom:48px">Gap Analysis · Refactor Plan · Rebuild Recommendation</p>
  <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:48px">
    ${[['SEO', scores?.seo?.grade], ['Entity', scores?.entity?.grade], ['AI Search', scores?.ai_discoverability?.grade], ['Conversion', scores?.conversion?.grade], ['Content', scores?.content?.grade], ['A2A', scores?.a2a?.grade]].map(([label, grade]) => `
      <div style="background:#1e3020;border-radius:6px;padding:14px 18px;min-width:72px;text-align:center">
        <div style="font-size:18px;font-weight:bold;color:${gradeColor(grade as string)}">${grade ?? '?'}</div>
        <div style="font-size:8px;color:#7a9070;margin-top:4px">${label}</div>
      </div>
    `).join('')}
  </div>
  <p style="font-size:9px;color:#4a6048">${date} · Prepared by Foundation Stone Advisors</p>
</div>

<div class="page">
  <h1 style="font-size:20px;font-weight:bold;color:#1c2b1e;margin-bottom:8px">Executive Summary</h1>
  <hr style="border:none;border-top:0.5px solid #ddd8cc;margin-bottom:12px"/>
  <p style="font-size:10px;line-height:1.6;color:#1a1a1a;margin-bottom:12px">
    ${orgName} at ${domain} has been analyzed against our ${audit.vertical} standards across six dimensions.
    ${audit.rebuild_recommended ? 'The site requires a full rebuild to compete effectively.' : 'The site has a strong foundation with targeted improvements needed.'}
  </p>
  <div class="callout">
    <em style="font-size:10px;color:#1c2b1e">"${audit.rebuild_reason ?? 'A comprehensive improvement plan will significantly improve visibility and conversion.'}"</em>
  </div>
  <h2 style="font-size:14px;font-weight:bold;color:#1c2b1e;margin:16px 0 8px">Overall Scores</h2>
  ${scoreTable}
</div>

${audit.quick_wins && (audit.quick_wins as SiteAuditQuickWin[]).length > 0 ? `
<div class="page">
  ${sectionHeader(7, 'Quick Wins & Next Steps')}
  <h2 style="font-size:14px;font-weight:bold;color:#1c2b1e;margin-bottom:8px">Immediate improvements available</h2>
  <table style="width:100%;border-collapse:collapse;border-radius:6px;overflow:hidden">
    ${tableHeader(['Action', 'Time Estimate', 'Impact'])}
    ${(audit.quick_wins as SiteAuditQuickWin[]).map((w, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f5f3ee'}">
        <td style="padding:7px 10px;font-size:9px;font-family:Helvetica,sans-serif">${w.action}</td>
        <td style="padding:7px 10px;font-size:9px;font-family:Helvetica,sans-serif">${w.time_estimate}</td>
        <td style="padding:7px 10px;font-size:9px;color:#4a5e4c;font-family:Helvetica,sans-serif">${w.impact}</td>
      </tr>
    `).join('')}
  </table>
</div>
` : ''}

</body></html>`
}

interface SiteAuditScore {
  grade: string
  score: number
  findings: string[]
  pages_found?: string[]
  pages_missing?: string[]
}

interface SiteAuditQuickWin {
  action: string
  time_estimate: string
  impact: string
}
```

---

## Step 7 — UI components

### Engagement detail — Site Audit tab

Add a "Site Audit" tab to the engagement detail page.
Follow the existing tab pattern in `src/components/TabNav.tsx`.

**The tab should contain:**

```tsx
// src/components/SiteAuditTab.tsx
'use client'

import { useState, useEffect } from 'react'
import { SiteAudit, SiteAuditVertical } from '@/types/pm'

interface Props {
  engagementId: string
  orgId: string
  defaultUrl?: string
}

export function SiteAuditTab({ engagementId, orgId, defaultUrl }: Props) {
  const [audits, setAudits] = useState<SiteAudit[]>([])
  const [activeAudit, setActiveAudit] = useState<SiteAudit | null>(null)
  const [url, setUrl] = useState(defaultUrl ?? '')
  const [vertical, setVertical] = useState<SiteAuditVertical>('church')
  const [running, setRunning] = useState(false)

  // Poll for audit status while running
  useEffect(() => {
    if (!activeAudit || activeAudit.status !== 'running') return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/pm/site-audit/${activeAudit.id}`)
      const data = await res.json()
      setActiveAudit(data)
      if (data.status === 'complete' || data.status === 'failed') {
        clearInterval(interval)
        setRunning(false)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [activeAudit])

  const runAudit = async () => {
    setRunning(true)
    const res = await fetch('/api/pm/site-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, vertical, org_id: orgId, engagement_id: engagementId }),
    })
    const data = await res.json()
    // Start polling
    const pollRes = await fetch(`/api/pm/site-audit/${data.audit_id}`)
    setActiveAudit(await pollRes.json())
  }

  const downloadPdf = async (auditId: string) => {
    const res = await fetch(`/api/pm/site-audit/${auditId}/pdf`, { method: 'POST' })
    const data = await res.json()
    if (data.pdf_url) window.open(data.pdf_url, '_blank')
  }

  const gradeColor = (grade: string) => {
    if (grade?.startsWith('A') || grade?.startsWith('B')) return 'text-green-400'
    if (grade?.startsWith('C')) return 'text-yellow-400'
    return 'text-red-400'
  }

  // Empty state — show form
  if (!activeAudit) return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-slate-200 mb-4">Run Site Audit</h3>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="text-sm text-slate-400 block mb-1">Website URL</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.example.com"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 block mb-1">Organization type</label>
          <select
            value={vertical}
            onChange={e => setVertical(e.target.value as SiteAuditVertical)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm"
          >
            <option value="church">Church / Ministry</option>
            <option value="agency">Agency / Professional services</option>
            <option value="nonprofit">Nonprofit / Community org</option>
          </select>
        </div>
        <button
          onClick={runAudit}
          disabled={!url || running}
          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {running ? 'Running audit...' : 'Run Site Audit'}
        </button>
      </div>
    </div>
  )

  // Running state
  if (activeAudit.status === 'running') return (
    <div className="p-6 text-center">
      <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-slate-400 text-sm">Analyzing site... this takes about 15 seconds</p>
    </div>
  )

  // Failed state
  if (activeAudit.status === 'failed') return (
    <div className="p-6">
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400 text-sm">Audit failed: {activeAudit.error_message}</p>
      </div>
      <button onClick={() => setActiveAudit(null)} className="mt-4 text-slate-400 text-sm hover:text-slate-200">
        Try again
      </button>
    </div>
  )

  // Complete state — show results
  const scores = activeAudit.scores as Record<string, { grade: string; score: number; findings: string[] }>
  const dimensions = [
    { key: 'seo', label: 'SEO' },
    { key: 'entity', label: 'Entity Authority' },
    { key: 'ai_discoverability', label: 'AI Discoverability' },
    { key: 'conversion', label: 'Conversion' },
    { key: 'content', label: 'Content' },
    { key: 'a2a', label: 'A2A Readiness' },
  ]

  return (
    <div className="p-6">
      {/* Score badges */}
      <div className="flex gap-3 flex-wrap mb-6">
        {dimensions.map(d => (
          <div key={d.key} className="bg-slate-800 rounded-lg p-3 text-center min-w-[80px]">
            <div className={`text-xl font-bold ${gradeColor(scores[d.key]?.grade)}`}>
              {scores[d.key]?.grade ?? '?'}
            </div>
            <div className="text-xs text-slate-500 mt-1">{d.label}</div>
          </div>
        ))}
      </div>

      {/* Overall */}
      <div className="flex items-center gap-4 mb-6">
        <div className="text-slate-400 text-sm">
          Overall: <span className={`font-bold ${gradeColor(activeAudit.overall_grade ?? '')}`}>
            {activeAudit.overall_grade} ({activeAudit.overall_score}/100)
          </span>
        </div>
        {activeAudit.rebuild_recommended && (
          <span className="bg-red-900/30 text-red-400 text-xs px-3 py-1 rounded-full border border-red-800">
            Rebuild recommended
          </span>
        )}
      </div>

      {/* Quick wins */}
      {activeAudit.quick_wins && (activeAudit.quick_wins as Array<{ action: string; time_estimate: string; impact: string }>).length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Quick wins</h4>
          <div className="space-y-2">
            {(activeAudit.quick_wins as Array<{ action: string; time_estimate: string; impact: string }>).map((w, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-orange-400 mt-0.5">→</span>
                <div>
                  <span className="text-slate-200">{w.action}</span>
                  <span className="text-slate-500 ml-2">({w.time_estimate})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => downloadPdf(activeAudit.id)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Download PDF Report
        </button>
        <button
          onClick={() => setActiveAudit(null)}
          className="border border-slate-600 text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg text-sm"
        >
          Run New Audit
        </button>
      </div>
    </div>
  )
}
```

### Standalone /site-audit page

Create `src/app/site-audit/page.tsx`:

```tsx
import { SiteAuditTab } from '@/components/SiteAuditTab'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SiteAuditPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get first org for the user — or add an org selector
  const { data: orgs } = await supabase
    .from('pm_organizations')
    .select('id, name')
    .limit(10)

  const defaultOrg = orgs?.[0]

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Site Audit Tool</h1>
        <p className="text-slate-400 mb-8">
          Enter any website URL to get a scored gap analysis and rebuild recommendations.
        </p>
        {defaultOrg ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <SiteAuditTab
              engagementId=""
              orgId={defaultOrg.id}
            />
          </div>
        ) : (
          <p className="text-slate-500">No organizations found. Create one first.</p>
        )}
      </div>
    </div>
  )
}
```

---

## Step 8 — Dependencies to install

```bash
npm install puppeteer-core @sparticuz/chromium
```

Add to `vercel.json` (create if it doesn't exist):
```json
{
  "functions": {
    "src/app/api/pm/site-audit/[id]/pdf/route.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

Puppeteer on Vercel needs more memory and a longer timeout.

---

## Step 9 — Update docs/API.md

Add these entries to the Site Audit section:

```markdown
## Site Audit

### POST /api/pm/site-audit
Run a site audit for a URL.
**Body:** { url, vertical, org_id, engagement_id? }
**Response:** { audit_id, status: 'running' } (202 — polls for completion)

### GET /api/pm/site-audit?org_id=<uuid>
List audits for an org.

### GET /api/pm/site-audit/[id]
Get single audit with full results.

### POST /api/pm/site-audit/[id]/pdf
Generate and store PDF. Returns signed download URL.

### DELETE /api/pm/site-audit/[id]
Delete audit record.
```

---

## Definition of done — Feature 1

- [ ] Migration applied and verified in Supabase dashboard
- [ ] RLS tested — two orgs cannot see each other's audits
- [ ] POST /api/pm/site-audit returns 202 with audit_id
- [ ] Audit status updates to 'complete' after GPT-4o scoring
- [ ] Scores JSON contains all 6 dimensions with grades
- [ ] PDF generates and stores in Supabase Storage `documents` bucket
- [ ] Signed URL returns and opens the PDF
- [ ] SiteAuditTab renders on engagement detail page
- [ ] Score badges display with correct colors
- [ ] Quick wins list renders
- [ ] Download PDF button works
- [ ] Standalone /site-audit page accessible
- [ ] Tested on at least 2 real URLs (try resonatejax.com and an agency site)
- [ ] docs/API.md updated
- [ ] docs/SUPABASE.md updated with new table
- [ ] No TypeScript errors
- [ ] Build passes

---

## Known gotchas

**Puppeteer on Vercel:** `@sparticuz/chromium` is the correct package for serverless.
Do not use the full `puppeteer` package — it won't run on Vercel.
Test locally with `CHROMIUM_PATH` env var pointing to your local Chrome.

**Async audit pattern:** The POST route returns immediately with a 202 and an audit_id.
The actual scoring runs async. The UI polls GET /api/pm/site-audit/[id] every 2 seconds.
This prevents Vercel's 10-second function timeout from killing the audit mid-run.

**GPT-4o context limit:** The site fetcher caps content at 12,000 characters.
If a site returns very little content (JavaScript-only SPA), the scores will be lower
and findings will note "Limited content available for analysis."

**Rubric files at runtime:** The rubric loader reads from `docs/seo/` at runtime.
Those files must be committed to the repo and present on Vercel's filesystem.
They will be — they're in the repo. This just means they're loaded fresh each audit.

## Session startup for this feature

```
Pull latest and get up to speed.
We are building Feature 1 — Site Audit Tool.
The spec is in docs/FEATURE_1_SITE_AUDIT.md.
Start with the database migration in Step 1.
Do not skip reading the existing patterns in
src/app/api/pm/reports/rollup/route.ts and src/lib/openai.ts first.
```
