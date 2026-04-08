import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { writeVaultFile } from "@/lib/vault";
import { assembleKBContext } from "@/lib/kb";
import { reportLimiter, rateLimitExceeded } from "@/lib/ratelimit";

// POST /api/pm/reports/standup — Generate AI daily standup
// Body: { project_id, org_slug, project_slug }
export async function POST(request: NextRequest) {
  try {
    const { project_id, org_slug, project_slug } = await request.json();

    if (!project_id || !org_slug || !project_slug) {
      return NextResponse.json(
        { error: "project_id, org_slug, and project_slug are required" },
        { status: 400 }
      );
    }

    // SEC-005: Rate limit by project ID (10 reports/hour)
    const { success: rlOk } = await reportLimiter.limit(project_id);
    if (!rlOk) return rateLimitExceeded();

    const supabase = createServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Fetch project context
    const [
      { data: project },
      { data: phases },
      { data: tasks },
      { data: risks },
      { data: recentLogs },
    ] = await Promise.all([
      supabase.from("pm_projects").select("*").eq("id", project_id).single(),
      supabase.from("pm_phases").select("*").eq("project_id", project_id).order("phase_order"),
      supabase.from("pm_tasks").select("*").eq("project_id", project_id),
      supabase.from("pm_risks").select("*").eq("project_id", project_id).eq("status", "open"),
      supabase
        .from("pm_daily_logs")
        .select("*")
        .eq("project_id", project_id)
        .order("log_date", { ascending: false })
        .limit(3),
    ]);

    const taskList = tasks ?? [];
    const complete = taskList.filter((t: { status: string }) => t.status === "complete");
    const inProgress = taskList.filter((t: { status: string }) => t.status === "in-progress");
    const blocked = taskList.filter((t: { status: string }) => t.status === "blocked");
    const overdue = taskList.filter(
      (t: { status: string; due_date: string | null }) =>
        t.due_date && t.due_date < today && t.status !== "complete"
    );
    const dueSoon = taskList.filter(
      (t: { status: string; due_date: string | null }) =>
        t.due_date &&
        t.due_date >= today &&
        t.due_date <= new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0] &&
        t.status !== "complete"
    );

    // Recently completed (completed tasks — check if they have updated_at within last 24h, or fall back to complete status)
    const recentlyCompleted = complete.filter(
      (t: { updated_at?: string; due_date?: string }) =>
        (t.updated_at && t.updated_at >= yesterday) || false
    );

    const context = `
Project: ${project?.name} (${project?.status})
Date: ${today}
Overall Progress: ${taskList.length > 0 ? Math.round((complete.length / taskList.length) * 100) : 0}% (${complete.length}/${taskList.length} tasks complete)

Phase Status:
${phases?.map((p: { phase_order: number; name: string; status: string; progress: number; group: string }) => `  P${String(p.phase_order).padStart(2, "0")} ${p.name} [${p.group ?? ""}] — ${p.status} (${p.progress}%)`).join("\n") ?? "  None"}

In Progress (${inProgress.length}):
${inProgress.map((t: { name: string; owner: string; due_date: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"}, due: ${t.due_date ?? "—"})`).join("\n") || "  None"}

Blocked (${blocked.length}):
${blocked.map((t: { name: string; owner: string; description: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"}): ${t.description ?? "no details"}`).join("\n") || "  None"}

Overdue (${overdue.length}):
${overdue.map((t: { name: string; owner: string; due_date: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"}, was due: ${t.due_date})`).join("\n") || "  None"}

Due in Next 3 Days (${dueSoon.length}):
${dueSoon.map((t: { name: string; owner: string; due_date: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"}, due: ${t.due_date})`).join("\n") || "  None"}

Recently Completed (${recentlyCompleted.length}):
${recentlyCompleted.map((t: { name: string; owner: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"})`).join("\n") || "  None"}

Open Risks (${risks?.length ?? 0}):
${risks?.map((r: { title: string; probability: string; impact: string }) => `  - ${r.title} [P:${r.probability} I:${r.impact}]`).join("\n") ?? "  None"}

Previous Standups:
${recentLogs?.map((l: { log_date: string; content: string }) => `  [${l.log_date}] ${l.content.slice(0, 200)}...`).join("\n") ?? "  None"}
`;

    const kbContext = await assembleKBContext(project?.org_id, project_id);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are a project management AI generating a daily standup report. Write a concise, actionable daily standup in markdown format.

Structure:
## Daily Standup — [Date]

### Yesterday
- What was accomplished (based on recently completed tasks and progress changes)

### Today
- What should be worked on (in-progress tasks, upcoming deadlines)
- Priority items that need attention

### Blockers
- Any blocked tasks and recommended actions
- Overdue items that need escalation

### Risks & Flags
- Open risks that may impact today's work
- Upcoming deadlines that need preparation

Keep it concise — this is a daily update, not a full report. Use bullet points. Highlight the most important 3-5 items.`,
        },
        { role: "user", content: `Generate today's daily standup:\n${context}${kbContext}` },
      ],
    });

    const standupContent = response.choices[0]?.message?.content ?? "Standup generation failed.";

    // Save to pm_daily_logs
    await supabase.from("pm_daily_logs").upsert(
      {
        project_id,
        log_date: today,
        content: standupContent,
        generated_by: "ai",
      },
      { onConflict: "project_id,log_date" }
    );

    // Save to vault
    const storagePath = `${org_slug}/${project_slug}/daily/${today}.md`;
    await writeVaultFile(
      storagePath,
      { type: "daily-standup", project: project_slug, date: today, generated: "ai" },
      standupContent
    );

    // Index in pm_files
    await supabase.from("pm_files").upsert(
      {
        project_id,
        storage_path: storagePath,
        file_type: "daily",
        title: `Daily Standup ${today}`,
        frontmatter: { type: "daily-standup", date: today },
      },
      { onConflict: "project_id,storage_path" }
    );

    return NextResponse.json({ report: standupContent, path: storagePath, date: today });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// GET /api/pm/reports/standup?project_id=...&limit=7 — Fetch recent standups
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("project_id");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "7", 10);

    if (!projectId) {
      return NextResponse.json({ error: "project_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_daily_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("log_date", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
