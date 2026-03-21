# FEATURE_2_STANDUP_AGENT.md
## Standup Agent — Complete Build Specification
## Hand this to Claude Code as the primary instruction document

---

## What you are building

A morning standup agent that generates a plain-language team status summary
from live PM data. The summary covers all active projects for an org —
what was completed recently, what is in progress, what is blocked, and
what is due soon.

Output is saved to `pm_daily_logs` (table already exists).
Displayed on the hub/dashboard as today's standup.
Optionally emailed via Resend (already wired up).
Auto-runs via Vercel Cron at 8am weekdays.

---

## Read these files before writing any code

```
CLAUDE.md
docs/CONTEXT.md
docs/SUPABASE.md                         ← pm_daily_logs table structure
docs/ENVIRONMENT.md                      ← RESEND_API_KEY, confirm it is set
src/app/api/pm/reports/rollup/route.ts   ← follow this AI generation pattern
src/app/api/pm/reports/hub/route.ts      ← cross-project pattern to follow
src/lib/openai.ts                        ← always use getOpenAI()
src/lib/email.ts                         ← Resend already wired, use sendEmail()
src/lib/supabase/server.ts               ← server-side client
src/types/pm.ts                          ← add new types here
vercel.json                              ← check if crons already configured
```

---

## What already exists — do not rebuild

- `pm_daily_logs` table — already in schema, used by reports
- `pm_tasks` with `status`, `due_date`, `owner`, `org_id` columns
- `pm_projects` with `status` field — filter on `status = 'active'`
- `pm_phases` with `progress`, `status`, `project_id`
- `src/lib/email.ts` with `sendEmail()` — Resend already integrated
- `/api/cron/engagement-nudge` — existing Vercel Cron route to follow as pattern
- `getOpenAI()` in `src/lib/openai.ts` — lazy init, always use this

---

## Step 1 — No migration needed

`pm_daily_logs` already exists with these columns:

```
id          uuid        PK
project_id  uuid        FK → pm_projects (nullable — use null for cross-project standup)
date        date        (unique per project — for cross-org standup use org_id instead)
content     text        markdown content
generated_by text       'ai' or 'manual' — use 'standup-agent'
created_at  timestamptz
```

**One thing to check:** `pm_daily_logs` has a unique constraint on `(project_id, date)`.
For the standup we are writing one entry per org per day, not per project.
Check if `project_id` is nullable and if there is a unique constraint issue.

If `project_id` is NOT NULL or has a unique constraint that would prevent
multiple null entries per day, add this migration:

```sql
-- Only run this if needed after checking the schema
-- supabase/migrations/025_standup_org_logs.sql

-- Make project_id nullable if not already
alter table pm_daily_logs
  alter column project_id drop not null;

-- Add org_id column for cross-org standups
alter table pm_daily_logs
  add column if not exists org_id uuid references pm_organizations(id) on delete cascade;

-- Add standup type
alter table pm_daily_logs
  add column if not exists log_type text not null default 'daily'
  check (log_type in ('daily', 'standup', 'rollup', 'blocker', 'hub', 'decisions'));

-- Index for org-based queries
create index if not exists pm_daily_logs_org_idx on pm_daily_logs(org_id, date);

-- RLS update if needed (existing policies may cover this via project → org chain)
-- Check existing RLS before adding new policies
```

**Check the schema first. Only run the migration if the columns are missing.**

---

## Step 2 — TypeScript types

Add to `src/types/pm.ts`:

```typescript
export type DailyLogType = 'daily' | 'standup' | 'rollup' | 'blocker' | 'hub' | 'decisions'

export interface StandupData {
  org_id: string
  date: string
  completed_yesterday: StandupItem[]
  in_progress_today: StandupItem[]
  blocked: StandupItem[]
  due_soon: StandupItem[]       // due within 3 days
  overdue: StandupItem[]
  project_summaries: ProjectStandupSummary[]
}

export interface StandupItem {
  task_name: string
  project_name: string
  owner: string | null
  due_date: string | null
  status: string
}

export interface ProjectStandupSummary {
  project_id: string
  project_name: string
  current_phase: string | null
  phase_progress: number
  open_tasks: number
  blocked_tasks: number
  completed_this_week: number
  overdue_tasks: number
}
```

---

## Step 3 — Data assembler utility

Create `src/lib/standup-assembler.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { StandupData, StandupItem, ProjectStandupSummary } from '@/types/pm'

export async function assembleStandupData(
  orgId: string,
  date: Date = new Date()
): Promise<StandupData> {
  const supabase = createClient()

  const today = date.toISOString().split('T')[0]
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const threeDaysFromNow = new Date(date)
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0]

  // Get all active projects for this org
  const { data: projects } = await supabase
    .from('pm_projects')
    .select('id, name, slug')
    .eq('org_id', orgId)
    .eq('status', 'active')

  if (!projects || projects.length === 0) {
    return {
      org_id: orgId,
      date: today,
      completed_yesterday: [],
      in_progress_today: [],
      blocked: [],
      due_soon: [],
      overdue: [],
      project_summaries: [],
    }
  }

  const projectIds = projects.map(p => p.id)
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))

  // Pull tasks across all active projects
  const { data: tasks } = await supabase
    .from('pm_tasks')
    .select('id, name, status, owner, due_date, project_id, updated_at')
    .in('project_id', projectIds)
    .not('status', 'eq', 'archived')

  if (!tasks) {
    return {
      org_id: orgId,
      date: today,
      completed_yesterday: [],
      in_progress_today: [],
      blocked: [],
      due_soon: [],
      overdue: [],
      project_summaries: [],
    }
  }

  const toItem = (t: typeof tasks[0]): StandupItem => ({
    task_name: t.name,
    project_name: projectMap[t.project_id ?? ''] ?? 'Unknown',
    owner: t.owner,
    due_date: t.due_date,
    status: t.status,
  })

  // Completed yesterday (updated_at within yesterday, status = complete)
  const completedYesterday = tasks
    .filter(t =>
      t.status === 'complete' &&
      t.updated_at >= `${yesterdayStr}T00:00:00` &&
      t.updated_at < `${today}T00:00:00`
    )
    .slice(0, 10) // cap for prompt length
    .map(toItem)

  // In progress
  const inProgress = tasks
    .filter(t => t.status === 'in-progress')
    .slice(0, 15)
    .map(toItem)

  // Blocked
  const blocked = tasks
    .filter(t => t.status === 'blocked')
    .map(toItem)

  // Due soon (not complete, due within 3 days)
  const dueSoon = tasks
    .filter(t =>
      t.due_date &&
      t.due_date >= today &&
      t.due_date <= threeDaysStr &&
      t.status !== 'complete'
    )
    .slice(0, 10)
    .map(toItem)

  // Overdue
  const overdue = tasks
    .filter(t =>
      t.due_date &&
      t.due_date < today &&
      t.status !== 'complete'
    )
    .slice(0, 10)
    .map(toItem)

  // Project summaries — pull phase progress
  const { data: phases } = await supabase
    .from('pm_phases')
    .select('project_id, name, progress, status, order')
    .in('project_id', projectIds)
    .order('order', { ascending: true })

  const projectSummaries: ProjectStandupSummary[] = projects.map(project => {
    const projectTasks = tasks.filter(t => t.project_id === project.id)
    const projectPhases = phases?.filter(p => p.project_id === project.id) ?? []

    // Current phase = first non-complete phase
    const currentPhase = projectPhases.find(p => p.status !== 'complete') ?? projectPhases[0]

    const completedThisWeek = tasks.filter(t => {
      const weekAgo = new Date(date)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return (
        t.project_id === project.id &&
        t.status === 'complete' &&
        t.updated_at >= weekAgo.toISOString()
      )
    }).length

    return {
      project_id: project.id,
      project_name: project.name,
      current_phase: currentPhase?.name ?? null,
      phase_progress: currentPhase?.progress ?? 0,
      open_tasks: projectTasks.filter(t => t.status !== 'complete').length,
      blocked_tasks: projectTasks.filter(t => t.status === 'blocked').length,
      completed_this_week: completedThisWeek,
      overdue_tasks: projectTasks.filter(t =>
        t.due_date && t.due_date < today && t.status !== 'complete'
      ).length,
    }
  })

  return {
    org_id: orgId,
    date: today,
    completed_yesterday: completedYesterday,
    in_progress_today: inProgress,
    blocked,
    due_soon: dueSoon,
    overdue,
    project_summaries: projectSummaries,
  }
}
```

---

## Step 4 — API routes

### POST /api/pm/standup/generate/route.ts

Create `src/app/api/pm/standup/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAI } from '@/lib/openai'
import { assembleStandupData } from '@/lib/standup-assembler'
import { sendEmail } from '@/lib/email'
import { z } from 'zod'

const GenerateStandupSchema = z.object({
  org_id: z.string().uuid(),
  date: z.string().optional(),         // YYYY-MM-DD, defaults to today
  send_email: z.boolean().optional(),  // default false
  email_to: z.string().email().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = GenerateStandupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { org_id, date, send_email, email_to } = parsed.data
  const targetDate = date ? new Date(date) : new Date()
  const dateStr = targetDate.toISOString().split('T')[0]

  // Get org name for context
  const { data: org } = await supabase
    .from('pm_organizations')
    .select('name')
    .eq('id', org_id)
    .single()

  // Assemble live data
  const standupData = await assembleStandupData(org_id, targetDate)

  // Build GPT-4o prompt
  const prompt = buildStandupPrompt(org?.name ?? 'your organization', dateStr, standupData)

  // Generate standup content
  const openai = getOpenAI()
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a project management assistant generating a concise morning standup summary. Write in plain markdown. Be direct and actionable. No fluff.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: 1000,
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: 'Failed to generate standup' }, { status: 500 })
  }

  // Save to pm_daily_logs
  // Use upsert in case standup was already generated today
  const { data: log, error: logError } = await supabase
    .from('pm_daily_logs')
    .upsert({
      project_id: null,         // cross-org standup, not project-specific
      org_id,                   // requires org_id column (check migration above)
      date: dateStr,
      content,
      generated_by: 'standup-agent',
      log_type: 'standup',
    }, {
      onConflict: 'org_id,date',  // update if already exists for today
      ignoreDuplicates: false,
    })
    .select()
    .single()

  // If upsert fails due to schema issue, fall back to insert
  if (logError) {
    const { data: insertLog } = await supabase
      .from('pm_daily_logs')
      .insert({
        project_id: null,
        date: dateStr,
        content,
        generated_by: 'standup-agent',
      })
      .select()
      .single()
  }

  // Send email if requested
  if (send_email && email_to) {
    await sendEmail({
      to: email_to,
      subject: `Morning Standup — ${org?.name ?? 'Team'} — ${dateStr}`,
      html: markdownToSimpleHtml(content, org?.name ?? 'Team', dateStr),
      text: content,
    }).catch(err => {
      console.error('Standup email failed:', err)
      // Don't fail the request if email fails
    })
  }

  return NextResponse.json({
    content,
    date: dateStr,
    org_id,
    projects_covered: standupData.project_summaries.length,
    blocked_count: standupData.blocked.length,
    overdue_count: standupData.overdue.length,
  })
}

function buildStandupPrompt(
  orgName: string,
  date: string,
  data: ReturnType<typeof assembleStandupData> extends Promise<infer T> ? T : never,
): string {
  const hasData = data.project_summaries.length > 0

  if (!hasData) {
    return `Generate a brief standup message for ${orgName} on ${date} noting there are no active projects currently tracked.`
  }

  return `
Generate a morning standup for ${orgName} on ${date}.

ACTIVE PROJECTS (${data.project_summaries.length}):
${data.project_summaries.map(p => `- ${p.project_name}: ${p.current_phase ?? 'No current phase'} (${p.phase_progress}% complete) | Open: ${p.open_tasks} tasks | Blocked: ${p.blocked_tasks} | Overdue: ${p.overdue_tasks}`).join('\n')}

COMPLETED YESTERDAY (${data.completed_yesterday.length}):
${data.completed_yesterday.length > 0
  ? data.completed_yesterday.map(t => `- ${t.task_name} [${t.project_name}]${t.owner ? ` — ${t.owner}` : ''}`).join('\n')
  : '- Nothing marked complete yesterday'}

IN PROGRESS TODAY (${data.in_progress_today.length}):
${data.in_progress_today.length > 0
  ? data.in_progress_today.slice(0, 8).map(t => `- ${t.task_name} [${t.project_name}]${t.owner ? ` — ${t.owner}` : ''}`).join('\n')
  : '- No tasks currently in progress'}

BLOCKED (${data.blocked.length}):
${data.blocked.length > 0
  ? data.blocked.map(t => `- ${t.task_name} [${t.project_name}]${t.owner ? ` — ${t.owner}` : ''}`).join('\n')
  : '- Nothing blocked'}

DUE WITHIN 3 DAYS (${data.due_soon.length}):
${data.due_soon.length > 0
  ? data.due_soon.map(t => `- ${t.task_name} [${t.project_name}] due ${t.due_date}`).join('\n')
  : '- Nothing due soon'}

OVERDUE (${data.overdue.length}):
${data.overdue.length > 0
  ? data.overdue.map(t => `- ${t.task_name} [${t.project_name}] was due ${t.due_date}`).join('\n')
  : '- Nothing overdue'}

Write a standup covering:
## Completed Yesterday
## In Progress Today
## Blocked (if any)
## Due Soon
## Watch List (overdue items if any)

Rules:
- Use bold for project names
- Keep each section to bullet points
- Flag blocked and overdue items clearly
- No filler text — just the facts
- If a section has nothing, write "Nothing to report"
- Total length: under 400 words
`
}

function markdownToSimpleHtml(markdown: string, orgName: string, date: string): string {
  // Simple markdown to HTML conversion for email
  const body = markdown
    .replace(/^## (.+)$/gm, '<h2 style="color:#1c2b1e;font-family:sans-serif;margin:20px 0 8px">$1</h2>')
    .replace(/^- (.+)$/gm, '<li style="font-family:sans-serif;font-size:14px;color:#333;line-height:1.6">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/>')

  return `
    <div style="max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#1c2b1e;padding:16px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:#e8dfc8;font-family:sans-serif;font-size:18px;margin:0">
          Morning Standup — ${orgName}
        </h1>
        <p style="color:#7a9070;font-family:sans-serif;font-size:13px;margin:4px 0 0">${date}</p>
      </div>
      <div style="background:#faf9f6;padding:24px;border:1px solid #ddd8cc;border-top:none;border-radius:0 0 8px 8px">
        ${body}
      </div>
    </div>
  `
}
```

### GET /api/pm/standup/route.ts

Create `src/app/api/pm/standup/route.ts` for fetching standup history:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = req.nextUrl.searchParams.get('org_id')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '7')

  if (!orgId) {
    return NextResponse.json({ error: 'org_id required' }, { status: 400 })
  }

  // Try org_id column first, fall back to generated_by filter
  let { data, error } = await supabase
    .from('pm_daily_logs')
    .select('*')
    .eq('org_id', orgId)
    .eq('generated_by', 'standup-agent')
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    // Fallback if org_id column doesn't exist yet
    const fallback = await supabase
      .from('pm_daily_logs')
      .select('*')
      .eq('generated_by', 'standup-agent')
      .order('date', { ascending: false })
      .limit(limit)
    data = fallback.data
  }

  return NextResponse.json(data ?? [])
}
```

---

## Step 5 — Vercel Cron route

Create `src/app/api/cron/standup/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Vercel Cron — runs weekdays at 8am
// Configured in vercel.json

export async function POST(req: NextRequest) {
  // Verify this is from Vercel Cron (not a random POST)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  // Get all orgs with active projects
  const { data: orgs } = await supabase
    .from('pm_organizations')
    .select('id, name')
    .not('id', 'is', null)

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: 'No orgs found' })
  }

  const results = []

  for (const org of orgs) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/pm/standup/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Use service role for cron — no user session
            'x-internal-cron': process.env.CRON_SECRET ?? '',
          },
          body: JSON.stringify({
            org_id: org.id,
            send_email: false, // email can be enabled per org later
          }),
        }
      )
      const data = await res.json()
      results.push({ org: org.name, status: res.ok ? 'ok' : 'failed', data })
    } catch (err) {
      results.push({ org: org.name, status: 'error', error: String(err) })
    }
  }

  return NextResponse.json({ generated: results.length, results })
}
```

**Note:** The standup generate route currently requires auth via `supabase.auth.getUser()`.
For the cron to work, add a bypass for internal cron calls — check for the
`x-internal-cron` header with `CRON_SECRET` and skip the user auth check.

Add this at the top of the generate route's POST function:

```typescript
// Allow cron bypass
const internalCronHeader = req.headers.get('x-internal-cron')
const isCron = internalCronHeader === process.env.CRON_SECRET

if (!isCron) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

---

## Step 6 — Vercel configuration

Add or update `vercel.json` in the repo root:

```json
{
  "crons": [
    {
      "path": "/api/cron/engagement-nudge",
      "schedule": "0 9 * * 1-5"
    },
    {
      "path": "/api/cron/standup",
      "schedule": "0 8 * * 1-5"
    }
  ]
}
```

Add `CRON_SECRET` to your environment variables:
- Vercel Dashboard → Project → Settings → Environment Variables
- Add: `CRON_SECRET` = any long random string (e.g. generate with `openssl rand -hex 32`)
- Also add to `.env.local` for local testing

Add `NEXT_PUBLIC_APP_URL` if not already set:
- Value: `https://your-vercel-domain.vercel.app` (or custom domain)

---

## Step 7 — UI component

Create `src/components/StandupWidget.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'

interface StandupLog {
  id: string
  date: string
  content: string
  generated_by: string
  created_at: string
}

interface Props {
  orgId: string
  adminEmail?: string
}

export function StandupWidget({ orgId, adminEmail }: Props) {
  const [today, setToday] = useState<StandupLog | null>(null)
  const [history, setHistory] = useState<StandupLog[]>([])
  const [generating, setGenerating] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadStandups()
  }, [orgId])

  const loadStandups = async () => {
    const res = await fetch(`/api/pm/standup?org_id=${orgId}&limit=7`)
    const data: StandupLog[] = await res.json()
    const todayLog = data.find(d => d.date === todayStr) ?? null
    setToday(todayLog)
    setHistory(data.filter(d => d.date !== todayStr))
  }

  const generateStandup = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/pm/standup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          send_email: sendEmail,
          email_to: sendEmail ? adminEmail : undefined,
        }),
      })
      const data = await res.json()
      if (data.content) {
        await loadStandups()
      }
    } finally {
      setGenerating(false)
    }
  }

  // Render markdown as simple HTML
  const renderMarkdown = (md: string) => {
    return md
      .replace(/^## (.+)$/gm, '<h3 class="text-slate-200 font-semibold text-sm mt-4 mb-2">$1</h3>')
      .replace(/^- (.+)$/gm, '<div class="flex gap-2 text-slate-300 text-sm py-0.5"><span class="text-orange-400 mt-0.5 shrink-0">→</span><span>$1</span></div>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-100">$1</strong>')
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400"></div>
          <span className="text-slate-200 font-medium text-sm">Morning Standup</span>
          <span className="text-slate-500 text-xs">{todayStr}</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              {showHistory ? 'Hide history' : `${history.length} previous`}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {today ? (
          <div
            dangerouslySetInnerHTML={{ __html: renderMarkdown(today.content) }}
            className="space-y-1"
          />
        ) : (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm mb-4">No standup generated yet today</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {adminEmail && (
                <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={e => setSendEmail(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  Email to {adminEmail}
                </label>
              )}
              <button
                onClick={generateStandup}
                disabled={generating}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Standup'}
              </button>
            </div>
          </div>
        )}

        {/* Regenerate option */}
        {today && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
            <span className="text-slate-600 text-xs">
              Generated {new Date(today.created_at).toLocaleTimeString()}
            </span>
            <button
              onClick={generateStandup}
              disabled={generating}
              className="text-slate-500 hover:text-slate-300 text-xs disabled:opacity-50"
            >
              {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
        )}
      </div>

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="border-t border-slate-700 divide-y divide-slate-700/50">
          {history.map(log => (
            <details key={log.id} className="group">
              <summary className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/30">
                <span className="text-slate-400 text-sm">{log.date}</span>
                <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div
                className="px-5 pb-4 space-y-1"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(log.content) }}
              />
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Add to dashboard/hub page

Find your main dashboard or hub page and add the widget:

```tsx
import { StandupWidget } from '@/components/StandupWidget'

// Inside the page component, after fetching org data:
<StandupWidget
  orgId={org.id}
  adminEmail={user.email}
/>
```

---

## Step 8 — Update docs/API.md

Add to `docs/API.md`:

```markdown
## Standup Agent

### POST /api/pm/standup/generate
Generate morning standup from live project data.
**Body:** { org_id, date?, send_email?, email_to? }
**Response:** { content, date, org_id, projects_covered, blocked_count, overdue_count }

### GET /api/pm/standup?org_id=<uuid>&limit=7
List standup history for an org. Default limit 7 (one week).

### POST /api/cron/standup (Vercel Cron)
Auto-generates standup for all orgs. Runs weekdays at 8am.
Requires Authorization: Bearer {CRON_SECRET}
```

---

## Definition of done — Feature 2

- [ ] Schema check completed — `org_id` and `log_type` columns added if needed
- [ ] `assembleStandupData()` returns correctly shaped data for an active org
- [ ] POST /api/pm/standup/generate returns standup content
- [ ] Content saved to `pm_daily_logs`
- [ ] GET /api/pm/standup returns today's standup for an org
- [ ] `StandupWidget` renders on dashboard with today's content
- [ ] "Generate Standup" button works when no standup exists
- [ ] "Regenerate" button updates existing standup
- [ ] History accordion shows previous standups
- [ ] Email send works via Resend when send_email is true
- [ ] Vercel Cron configured in `vercel.json`
- [ ] `CRON_SECRET` added to Vercel environment variables
- [ ] `NEXT_PUBLIC_APP_URL` set in Vercel environment variables
- [ ] Cron route tested manually (POST with correct auth header)
- [ ] No TypeScript errors
- [ ] Build passes
- [ ] docs/API.md updated

---

## Known gotchas

**`pm_daily_logs` unique constraint:** The existing table was designed for
per-project daily logs. The standup is per-org. Check whether `(project_id, date)`
has a unique constraint that prevents null project_id rows for the same date.
If yes, run migration 025. If the table already has `org_id`, skip it.

**Cron auth:** Vercel Cron routes do NOT have a user session. The standup
generate route needs the internal cron bypass added (Step 4 note above) or
the cron route will get 401 errors.

**Empty orgs:** If an org has no active projects, the standup will say so.
That's correct behavior — don't generate fake content.

**Email graceful degradation:** `sendEmail()` already handles missing
`RESEND_API_KEY` gracefully. Email failures don't fail the API response.

## Session startup for this feature

```
Pull latest and get up to speed.
We are building Feature 2 — the Standup Agent.
The spec is in docs/FEATURE_2_STANDUP_AGENT.md.
Start by checking the pm_daily_logs schema to see if
org_id and log_type columns exist before running any migration.
```
