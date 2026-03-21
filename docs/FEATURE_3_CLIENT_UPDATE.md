# FEATURE_3_CLIENT_UPDATE.md
## Client Update Generator — Complete Build Specification
## Hand this to Claude Code as the primary instruction document

---

## What you are building

A client update generator that produces a professional weekly status email
for clients from live project data. The flow is:

1. Team member clicks "Generate Client Update" on a project
2. System pulls completed tasks, phase progress, and blockers for the week
3. GPT-4o writes a client-facing update in plain language (no jargon)
4. Draft appears in UI for team review and editing
5. Team clicks "Send to Client" — Resend delivers it
6. Update is logged in `pm_client_notes` with status tracking

**Key design decision: human in the loop.**
Nothing sends automatically. The team always reviews before sending.

---

## Read these files before writing any code

```
CLAUDE.md
docs/CONTEXT.md
docs/SUPABASE.md                             ← pm_client_notes structure
docs/INTEGRATIONS.md                         ← Resend already wired
src/app/api/pm/notes/route.ts                ← existing notes pattern to follow
src/app/api/pm/notes/summarize/route.ts      ← existing AI notes pattern
src/app/api/pm/reports/rollup/route.ts       ← AI generation pattern
src/lib/email.ts                             ← sendEmail() already exists
src/lib/openai.ts                            ← getOpenAI(), never top-level
src/lib/supabase/server.ts
src/types/pm.ts
```

---

## What already exists — do not rebuild

- `pm_client_notes` table — already exists, used for meeting notes, calls, follow-ups
- `src/lib/email.ts` with `sendEmail()` — Resend integration live
- `pm_tasks` with status, due_date, owner, updated_at
- `pm_phases` with progress, status, name
- `pm_projects` with status, name, org_id
- `/api/pm/notes` GET and POST routes — follow this pattern exactly
- `/api/pm/notes/summarize` — AI notes generation to reference

---

## Step 1 — Database additions

The `pm_client_notes` table already exists. We need to add columns
to support client update tracking without breaking existing notes.

Check if these columns exist first. Only add if missing:

```sql
-- supabase/migrations/025_client_updates.sql
-- (use next available number after checking ls supabase/migrations/)

-- Add client update tracking to pm_client_notes
alter table pm_client_notes
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'sent', 'archived')),
  add column if not exists sent_at timestamptz,
  add column if not exists sent_to_email text,
  add column if not exists sent_to_name text,
  add column if not exists project_id uuid references pm_projects(id) on delete set null,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists subject text;

-- Index for project-based queries
create index if not exists pm_client_notes_project_idx
  on pm_client_notes(project_id)
  where project_id is not null;

-- Index for status queries
create index if not exists pm_client_notes_status_idx
  on pm_client_notes(org_id, status);
```

**Run migration only after verifying columns do not already exist.**

---

## Step 2 — TypeScript types

Add to `src/types/pm.ts`:

```typescript
export type ClientNoteStatus = 'draft' | 'sent' | 'archived'

export interface ClientUpdateDraft {
  subject: string
  body: string
  period_start: string
  period_end: string
  project_name: string
  client_name: string
}

export interface GenerateClientUpdateRequest {
  project_id: string
  period_start?: string      // YYYY-MM-DD, default 7 days ago
  period_end?: string        // YYYY-MM-DD, default today
  client_email: string
  client_name: string
  tone?: 'formal' | 'friendly'
}

export interface ClientNote {
  id: string
  org_id: string
  project_id: string | null
  title: string
  body: string
  note_type: string
  author: string | null
  status: ClientNoteStatus
  sent_at: string | null
  sent_to_email: string | null
  sent_to_name: string | null
  period_start: string | null
  period_end: string | null
  subject: string | null
  created_at: string
  updated_at: string
}
```

---

## Step 3 — Data assembler

Create `src/lib/client-update-assembler.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'

export interface ClientUpdateData {
  project_name: string
  org_name: string
  period_start: string
  period_end: string
  completed_tasks: TaskSummary[]
  in_progress_tasks: TaskSummary[]
  blocked_tasks: TaskSummary[]
  current_phase: PhaseSummary | null
  next_phase: PhaseSummary | null
  overall_progress: number
  upcoming_milestones: TaskSummary[]
  decisions_needed: string[]
}

interface TaskSummary {
  name: string
  owner: string | null
  due_date: string | null
  status: string
}

interface PhaseSummary {
  name: string
  progress: number
  status: string
}

export async function assembleClientUpdateData(
  projectId: string,
  periodStart: string,
  periodEnd: string
): Promise<ClientUpdateData> {
  const supabase = createClient()

  // Get project and org
  const { data: project } = await supabase
    .from('pm_projects')
    .select('name, org_id, pm_organizations(name)')
    .eq('id', projectId)
    .single()

  const orgName = (project as Record<string, unknown> & {
    pm_organizations?: { name: string }
  })?.pm_organizations?.name ?? 'your organization'

  // Get tasks
  const { data: tasks } = await supabase
    .from('pm_tasks')
    .select('name, status, owner, due_date, updated_at, phase_id')
    .eq('project_id', projectId)
    .not('status', 'eq', 'archived')

  // Get phases
  const { data: phases } = await supabase
    .from('pm_phases')
    .select('id, name, progress, status, order')
    .eq('project_id', projectId)
    .order('order', { ascending: true })

  const toSummary = (t: typeof tasks extends null ? never : typeof tasks[0]): TaskSummary => ({
    name: t.name,
    owner: t.owner,
    due_date: t.due_date,
    status: t.status,
  })

  // Completed during period
  const completedTasks = (tasks ?? [])
    .filter(t =>
      t.status === 'complete' &&
      t.updated_at >= `${periodStart}T00:00:00` &&
      t.updated_at <= `${periodEnd}T23:59:59`
    )
    .slice(0, 10)
    .map(toSummary)

  // Currently in progress
  const inProgressTasks = (tasks ?? [])
    .filter(t => t.status === 'in-progress')
    .slice(0, 6)
    .map(toSummary)

  // Blocked
  const blockedTasks = (tasks ?? [])
    .filter(t => t.status === 'blocked')
    .map(toSummary)

  // Upcoming milestones — incomplete tasks with due dates in next 14 days
  const twoWeeksOut = new Date()
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)
  const twoWeeksStr = twoWeeksOut.toISOString().split('T')[0]

  const upcomingMilestones = (tasks ?? [])
    .filter(t =>
      t.due_date &&
      t.due_date >= periodEnd &&
      t.due_date <= twoWeeksStr &&
      t.status !== 'complete'
    )
    .slice(0, 5)
    .map(toSummary)

  // Phase analysis
  const currentPhase = (phases ?? []).find(p => p.status !== 'complete') ?? null
  const currentPhaseIndex = phases ? phases.indexOf(currentPhase as typeof phases[0]) : -1
  const nextPhase = phases && currentPhaseIndex >= 0
    ? (phases[currentPhaseIndex + 1] ?? null)
    : null

  // Overall progress — average of all phase progress
  const overallProgress = phases && phases.length > 0
    ? Math.round(phases.reduce((sum, p) => sum + (p.progress ?? 0), 0) / phases.length)
    : 0

  // Decisions needed — blocked tasks become decision requests
  const decisionsNeeded = blockedTasks
    .slice(0, 3)
    .map(t => `Input needed on: ${t.name}`)

  return {
    project_name: project?.name ?? 'Project',
    org_name: orgName,
    period_start: periodStart,
    period_end: periodEnd,
    completed_tasks: completedTasks,
    in_progress_tasks: inProgressTasks,
    blocked_tasks: blockedTasks,
    current_phase: currentPhase
      ? { name: currentPhase.name, progress: currentPhase.progress ?? 0, status: currentPhase.status }
      : null,
    next_phase: nextPhase
      ? { name: nextPhase.name, progress: nextPhase.progress ?? 0, status: nextPhase.status }
      : null,
    overall_progress: overallProgress,
    upcoming_milestones: upcomingMilestones,
    decisions_needed: decisionsNeeded,
  }
}
```

---

## Step 4 — API routes

### POST /api/pm/client-update/generate/route.ts

Create `src/app/api/pm/client-update/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAI } from '@/lib/openai'
import { assembleClientUpdateData } from '@/lib/client-update-assembler'
import { z } from 'zod'

const GenerateSchema = z.object({
  project_id: z.string().uuid(),
  client_email: z.string().email(),
  client_name: z.string().min(1),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  tone: z.enum(['formal', 'friendly']).optional().default('friendly'),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { project_id, client_email, client_name, tone } = parsed.data

  // Default period: last 7 days
  const periodEnd = parsed.data.period_end ?? new Date().toISOString().split('T')[0]
  const periodStartDate = new Date()
  periodStartDate.setDate(periodStartDate.getDate() - 7)
  const periodStart = parsed.data.period_start ?? periodStartDate.toISOString().split('T')[0]

  // Get project org_id
  const { data: project } = await supabase
    .from('pm_projects')
    .select('org_id, name')
    .eq('id', project_id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Assemble data
  const updateData = await assembleClientUpdateData(project_id, periodStart, periodEnd)

  // Generate with GPT-4o
  const openai = getOpenAI()
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You write professional client update emails for a digital agency.
Write in ${tone} tone. Plain language only — no technical jargon.
The client is non-technical. Focus on outcomes and progress, not process.
Keep it under 280 words. Be warm but concise.`,
      },
      {
        role: 'user',
        content: buildClientUpdatePrompt(client_name, updateData, tone),
      },
    ],
    max_tokens: 600,
  })

  const generatedBody = completion.choices[0]?.message?.content
  if (!generatedBody) {
    return NextResponse.json({ error: 'Failed to generate update' }, { status: 500 })
  }

  // Build subject line
  const subject = `${updateData.project_name} — Weekly Update ${formatDateRange(periodStart, periodEnd)}`

  // Save as draft in pm_client_notes
  const { data: note, error: noteError } = await supabase
    .from('pm_client_notes')
    .insert({
      org_id: project.org_id,
      project_id,
      title: subject,
      body: generatedBody,
      note_type: 'client-update',
      author: user.email ?? 'Team',
      status: 'draft',
      sent_to_email: client_email,
      sent_to_name: client_name,
      period_start: periodStart,
      period_end: periodEnd,
      subject,
    })
    .select()
    .single()

  if (noteError) {
    return NextResponse.json({ error: noteError.message }, { status: 500 })
  }

  return NextResponse.json({
    note_id: note.id,
    subject,
    body: generatedBody,
    period_start: periodStart,
    period_end: periodEnd,
    client_email,
    client_name,
    status: 'draft',
  }, { status: 201 })
}

function buildClientUpdatePrompt(
  clientName: string,
  data: Awaited<ReturnType<typeof assembleClientUpdateData>>,
  tone: string
): string {
  return `
Write a weekly project update email to ${clientName}.

PROJECT: ${data.project_name}
PERIOD: ${data.period_start} to ${data.period_end}
OVERALL PROGRESS: ${data.overall_progress}%
CURRENT PHASE: ${data.current_phase?.name ?? 'In progress'} (${data.current_phase?.progress ?? 0}% complete)
${data.next_phase ? `NEXT PHASE: ${data.next_phase.name}` : ''}

COMPLETED THIS WEEK (${data.completed_tasks.length} items):
${data.completed_tasks.length > 0
  ? data.completed_tasks.map(t => `- ${t.name}`).join('\n')
  : '- Work continued on existing items'}

IN PROGRESS:
${data.in_progress_tasks.length > 0
  ? data.in_progress_tasks.slice(0, 4).map(t => `- ${t.name}`).join('\n')
  : '- Ongoing development work'}

${data.blocked_tasks.length > 0 ? `ITEMS NEEDING CLIENT INPUT:
${data.blocked_tasks.map(t => `- ${t.name}`).join('\n')}` : ''}

${data.upcoming_milestones.length > 0 ? `COMING NEXT 2 WEEKS:
${data.upcoming_milestones.map(t => `- ${t.name}${t.due_date ? ` (by ${t.due_date})` : ''}`).join('\n')}` : ''}

Write the email with:
1. Brief warm opening (1-2 sentences)
2. What was accomplished this week (2-4 sentences in plain language)
3. Where the project stands (1-2 sentences on progress)
4. What client input is needed, if any (only if blocked items exist)
5. What to expect next week (1-2 sentences)
6. Brief professional close

Do NOT use bullet points in the email — write in flowing paragraphs.
Do NOT mention internal tools, file names, or technical details.
Do NOT use the word "deliverables" or "sprint" or "iteration".
Write as if you are personally updating a trusted client.
`
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${s}–${e}`
}
```

### POST /api/pm/client-update/[id]/send/route.ts

Create `src/app/api/pm/client-update/[id]/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Load the draft note
  const { data: note, error } = await supabase
    .from('pm_client_notes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  if (note.status === 'sent') {
    return NextResponse.json({ error: 'Already sent' }, { status: 400 })
  }

  if (!note.sent_to_email) {
    return NextResponse.json({ error: 'No recipient email on draft' }, { status: 400 })
  }

  // Send via Resend
  const emailResult = await sendEmail({
    to: note.sent_to_email,
    subject: note.subject ?? note.title,
    html: buildEmailHtml(note.sent_to_name ?? 'there', note.body, note.title),
    text: note.body,
  })

  if (!emailResult) {
    return NextResponse.json({ error: 'Email send failed — check RESEND_API_KEY' }, { status: 500 })
  }

  // Mark as sent
  const { data: updated } = await supabase
    .from('pm_client_notes')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  return NextResponse.json({
    sent: true,
    sent_at: updated?.sent_at,
    sent_to: note.sent_to_email,
  })
}

function buildEmailHtml(
  clientName: string,
  body: string,
  projectName: string
): string {
  // Convert plain paragraphs to HTML
  const htmlBody = body
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;margin:0 0 16px">${p.trim()}</p>`)
    .join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#1c2b1e;padding:20px 32px">
            <p style="font-family:sans-serif;font-size:11px;color:#7a9070;margin:0 0 4px;letter-spacing:.1em;text-transform:uppercase">Project Update</p>
            <p style="font-family:Georgia,serif;font-size:20px;color:#e8dfc8;margin:0">${projectName}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            ${htmlBody}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
            <p style="font-family:sans-serif;font-size:12px;color:#999;margin:0">
              Foundation Stone Advisors · Reply to this email with any questions
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`
}
```

### PATCH /api/pm/client-update/[id]/route.ts

Allow editing the draft before sending:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateSchema = z.object({
  body: z.string().optional(),
  subject: z.string().optional(),
  sent_to_email: z.string().email().optional(),
  sent_to_name: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  // Don't allow editing sent notes
  const { data: existing } = await supabase
    .from('pm_client_notes')
    .select('status')
    .eq('id', params.id)
    .single()

  if (existing?.status === 'sent') {
    return NextResponse.json({ error: 'Cannot edit a sent update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('pm_client_notes')
    .update(parsed.data)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

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
    .from('pm_client_notes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
```

### GET /api/pm/client-update/route.ts

List client updates for a project:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projectId = req.nextUrl.searchParams.get('project_id')
  const orgId = req.nextUrl.searchParams.get('org_id')

  let query = supabase
    .from('pm_client_notes')
    .select('*')
    .eq('note_type', 'client-update')
    .order('created_at', { ascending: false })
    .limit(20)

  if (projectId) query = query.eq('project_id', projectId)
  if (orgId) query = query.eq('org_id', orgId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
```

---

## Step 5 — UI component

Create `src/components/ClientUpdateTab.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'

interface ClientUpdate {
  id: string
  title: string
  body: string
  subject: string | null
  status: 'draft' | 'sent' | 'archived'
  sent_at: string | null
  sent_to_email: string | null
  sent_to_name: string | null
  period_start: string | null
  period_end: string | null
  created_at: string
}

interface Props {
  projectId: string
  orgId: string
}

export function ClientUpdateTab({ projectId, orgId }: Props) {
  const [updates, setUpdates] = useState<ClientUpdate[]>([])
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [clientEmail, setClientEmail] = useState('')
  const [clientName, setClientName] = useState('')
  const [tone, setTone] = useState<'friendly' | 'formal'>('friendly')

  useEffect(() => {
    loadUpdates()
  }, [projectId])

  const loadUpdates = async () => {
    const res = await fetch(`/api/pm/client-update?project_id=${projectId}`)
    if (res.ok) setUpdates(await res.json())
  }

  const generateUpdate = async () => {
    if (!clientEmail || !clientName) return
    setGenerating(true)
    setShowForm(false)
    try {
      const res = await fetch('/api/pm/client-update/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, client_email: clientEmail, client_name: clientName, tone }),
      })
      if (res.ok) {
        await loadUpdates()
      }
    } finally {
      setGenerating(false)
    }
  }

  const sendUpdate = async (id: string) => {
    setSending(id)
    try {
      const res = await fetch(`/api/pm/client-update/${id}/send`, { method: 'POST' })
      if (res.ok) await loadUpdates()
    } finally {
      setSending(null)
    }
  }

  const saveEdit = async (id: string, body: string, subject: string) => {
    await fetch(`/api/pm/client-update/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, subject }),
    })
    setEditingId(null)
    await loadUpdates()
  }

  const drafts = updates.filter(u => u.status === 'draft')
  const sent = updates.filter(u => u.status === 'sent')

  return (
    <div className="p-6 space-y-6">

      {/* Generate button */}
      <div className="flex items-center justify-between">
        <h3 className="text-slate-200 font-semibold">Client Updates</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Generate Update
        </button>
      </div>

      {/* Generate form */}
      {showForm && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
          <h4 className="text-slate-300 font-medium text-sm">Generate weekly update</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-xs block mb-1">Client name</label>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Client email</label>
              <input
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="jane@client.com"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1">Tone</label>
            <select
              value={tone}
              onChange={e => setTone(e.target.value as 'friendly' | 'formal')}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm"
            >
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={generateUpdate}
              disabled={!clientEmail || !clientName || generating}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Draft'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-500 hover:text-slate-300 text-sm px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wide">
            Drafts ({drafts.length})
          </h4>
          {drafts.map(update => (
            <ClientUpdateCard
              key={update.id}
              update={update}
              onSend={() => sendUpdate(update.id)}
              onEdit={() => setEditingId(update.id)}
              onSaveEdit={saveEdit}
              isEditing={editingId === update.id}
              isSending={sending === update.id}
            />
          ))}
        </div>
      )}

      {/* Sent */}
      {sent.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wide">
            Sent ({sent.length})
          </h4>
          {sent.map(update => (
            <div key={update.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-medium">{update.subject ?? update.title}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Sent to {update.sent_to_name} ({update.sent_to_email}) · {update.sent_at ? new Date(update.sent_at).toLocaleDateString() : ''}
                  </p>
                </div>
                <span className="text-green-400 text-xs bg-green-900/20 px-2 py-1 rounded-full border border-green-800/50">Sent</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {updates.length === 0 && !showForm && !generating && (
        <div className="text-center py-10">
          <p className="text-slate-500 text-sm">No client updates yet</p>
          <p className="text-slate-600 text-xs mt-1">Generate a weekly update to keep your client informed</p>
        </div>
      )}

    </div>
  )
}

interface CardProps {
  update: ClientUpdate
  onSend: () => void
  onEdit: () => void
  onSaveEdit: (id: string, body: string, subject: string) => void
  isEditing: boolean
  isSending: boolean
}

function ClientUpdateCard({ update, onSend, onEdit, onSaveEdit, isEditing, isSending }: CardProps) {
  const [editBody, setEditBody] = useState(update.body)
  const [editSubject, setEditSubject] = useState(update.subject ?? update.title)

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <p className="text-slate-200 text-sm font-medium">{update.subject ?? update.title}</p>
          <p className="text-slate-500 text-xs mt-0.5">
            To: {update.sent_to_name} ({update.sent_to_email})
            {update.period_start && ` · ${update.period_start} to ${update.period_end}`}
          </p>
        </div>
        <span className="text-orange-400 text-xs bg-orange-900/20 px-2 py-1 rounded-full border border-orange-800/50">Draft</span>
      </div>

      {/* Body */}
      <div className="p-5">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs block mb-1">Subject line</label>
              <input
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Email body</label>
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={12}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm font-mono resize-y"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onSaveEdit(update.id, editBody, editSubject)}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm"
              >
                Save changes
              </button>
              <button onClick={onEdit} className="text-slate-500 hover:text-slate-300 text-sm px-3 py-2">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
            {update.body}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="px-5 py-3 border-t border-slate-700 flex gap-3">
          <button
            onClick={onSend}
            disabled={isSending}
            className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isSending ? 'Sending...' : `Send to ${update.sent_to_name}`}
          </button>
          <button
            onClick={onEdit}
            className="border border-slate-600 text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg text-sm"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## Step 6 — Wire into project detail page

Add "Client Updates" tab to the project detail page.
Follow the existing `TabNav` pattern:

```tsx
// In your project detail tabs array, add:
{ key: 'client-updates', label: 'Client Updates' }

// In the tab content renderer:
{activeTab === 'client-updates' && (
  <ClientUpdateTab projectId={project.id} orgId={project.org_id} />
)}
```

Import at the top:
```tsx
import { ClientUpdateTab } from '@/components/ClientUpdateTab'
```

---

## Step 7 — Update docs/API.md

Add to `docs/API.md`:

```markdown
## Client Update Generator

### POST /api/pm/client-update/generate
Generate a weekly client update draft from project data.
**Body:** { project_id, client_email, client_name, period_start?, period_end?, tone? }
**Response:** { note_id, subject, body, status: 'draft' } (201)

### GET /api/pm/client-update?project_id=&org_id=
List client updates for a project or org.
**Response:** ClientNote[]

### GET /api/pm/client-update/[id]
Get single client update note.

### PATCH /api/pm/client-update/[id]
Edit draft body or subject before sending.
**Body:** { body?, subject?, sent_to_email?, sent_to_name? }

### POST /api/pm/client-update/[id]/send
Send approved draft to client via Resend.
**Response:** { sent, sent_at, sent_to }
```

---

## Definition of done — Feature 3

- [ ] Schema check done — columns added if missing
- [ ] POST /api/pm/client-update/generate returns a draft note
- [ ] Draft saved to `pm_client_notes` with status 'draft'
- [ ] Draft visible in ClientUpdateTab on project page
- [ ] Body is readable — no jargon, flows as paragraphs
- [ ] Edit mode works — body and subject editable
- [ ] Save changes persists edits correctly
- [ ] POST /api/pm/client-update/[id]/send delivers via Resend
- [ ] Email renders correctly in Gmail / Apple Mail (test both)
- [ ] Note status updates to 'sent' after sending
- [ ] Sent updates appear in the Sent section of the tab
- [ ] Cannot edit or re-send a sent update
- [ ] No TypeScript errors
- [ ] Build passes
- [ ] docs/API.md updated
- [ ] docs/SUPABASE.md updated if migration was needed

---

## Known gotchas

**Email rendering:** Test the HTML email in a real email client.
The inline CSS approach is intentional — email clients strip external stylesheets.
If it looks wrong, adjust the inline styles in `buildEmailHtml()`.

**`pm_client_notes` existing data:** The migration adds columns with defaults.
Existing notes will get `status = 'draft'` which is fine — they are not
actual client updates and won't appear in the client-update routes
because those filter by `note_type = 'client-update'`.

**Empty completed tasks:** If no tasks were marked complete during the period,
GPT-4o will still generate a sensible update based on in-progress work.
The prompt handles this gracefully.

**Resend from address:** Check `src/lib/email.ts` for the configured `from`
address. It should be `admin@foundationstoneadvisors.com` per `ENVIRONMENT.md`.
Resend requires the sending domain to be verified — confirm this is done.

## Session startup for this feature

```
Pull latest and get up to speed.
We are building Feature 3 — the Client Update Generator.
The spec is in docs/FEATURE_3_CLIENT_UPDATE.md.
Start with Step 1 — check if pm_client_notes already has
status, sent_at, project_id, and period_start columns.
Run the migration only if they are missing.
```
