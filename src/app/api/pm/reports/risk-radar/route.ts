import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { writeVaultFile } from "@/lib/vault";
import { assembleKBContext } from "@/lib/kb";

// POST /api/pm/reports/risk-radar — AI scan of escalating risks
// Body: { project_id, org_slug, project_slug } OR { org_id } for cross-project scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, org_slug, project_slug, org_id } = body;

    const supabase = createServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
    const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    let context = "";
    let kbContext = "";
    let scopeLabel = "";

    if (project_id) {
      // Single-project risk radar
      if (!org_slug || !project_slug) {
        return NextResponse.json(
          { error: "org_slug and project_slug required for project-level scan" },
          { status: 400 }
        );
      }

      const [
        { data: project },
        { data: phases },
        { data: tasks },
        { data: risks },
      ] = await Promise.all([
        supabase.from("pm_projects").select("*").eq("id", project_id).single(),
        supabase.from("pm_phases").select("*").eq("project_id", project_id).order("phase_order"),
        supabase.from("pm_tasks").select("*").eq("project_id", project_id),
        supabase.from("pm_risks").select("*").eq("project_id", project_id),
      ]);

      scopeLabel = project?.name || project_slug;
      const taskList = tasks ?? [];
      const blocked = taskList.filter((t: { status: string }) => t.status === "blocked");
      const overdue = taskList.filter(
        (t: { status: string; due_date: string | null }) =>
          t.due_date && t.due_date < today && t.status !== "complete"
      );
      const dueSoon = taskList.filter(
        (t: { status: string; due_date: string | null }) =>
          t.due_date && t.due_date >= today && t.due_date <= sevenDaysOut && t.status !== "complete"
      );
      const stalled = taskList.filter(
        (t: { status: string; updated_at?: string }) =>
          t.status === "in-progress" &&
          t.updated_at &&
          t.updated_at < new Date(Date.now() - 7 * 86400000).toISOString()
      );

      // Phases with low progress but in-progress status
      const stalledPhases = (phases ?? []).filter(
        (p: { status: string; progress: number }) =>
          p.status === "in-progress" && p.progress < 20
      );

      context = `
PROJECT: ${project?.name} (${project?.status})
Target Date: ${project?.target_date ?? "—"}
Progress: ${taskList.length > 0 ? Math.round((taskList.filter((t: { status: string }) => t.status === "complete").length / taskList.length) * 100) : 0}%

OPEN RISKS (${risks?.filter((r: { status: string }) => r.status === "open").length ?? 0}):
${risks?.filter((r: { status: string }) => r.status === "open").map((r: { title: string; probability: string; impact: string; mitigation: string; owner: string }) => `  - ${r.title} [P:${r.probability} I:${r.impact}] — Mitigation: ${r.mitigation ?? "none"} (owner: ${r.owner ?? "—"})`).join("\n") ?? "  None"}

MITIGATED RISKS (${risks?.filter((r: { status: string }) => r.status === "mitigated").length ?? 0}):
${risks?.filter((r: { status: string }) => r.status === "mitigated").map((r: { title: string; probability: string; impact: string }) => `  - ${r.title} [${r.probability}/${r.impact}]`).join("\n") ?? "  None"}

BLOCKED TASKS (${blocked.length}):
${blocked.map((t: { name: string; owner: string; description: string; depends_on?: string[] }) => `  - ${t.name} (owner: ${t.owner ?? "—"}) — ${t.description ?? "no details"}, depends on: ${t.depends_on?.join(", ") ?? "—"}`).join("\n") || "  None"}

OVERDUE TASKS (${overdue.length}):
${overdue.map((t: { name: string; owner: string; due_date: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"}, was due: ${t.due_date})`).join("\n") || "  None"}

DUE WITHIN 7 DAYS (${dueSoon.length}):
${dueSoon.map((t: { name: string; owner: string; due_date: string; status: string }) => `  - ${t.name} [${t.status}] (owner: ${t.owner ?? "—"}, due: ${t.due_date})`).join("\n") || "  None"}

STALLED TASKS (in-progress but no update in 7+ days) (${stalled.length}):
${stalled.map((t: { name: string; owner: string; updated_at?: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"}, last update: ${t.updated_at?.split("T")[0] ?? "unknown"})`).join("\n") || "  None"}

STALLED PHASES (in-progress but <20% complete) (${stalledPhases.length}):
${stalledPhases.map((p: { name: string; progress: number; owner?: string }) => `  - ${p.name} (${p.progress}%, owner: ${p.owner ?? "—"})`).join("\n") || "  None"}
`;
      kbContext = await assembleKBContext(project?.org_id, project_id);

    } else if (org_id) {
      // Cross-project risk radar for an org
      const { data: projects } = await supabase
        .from("pm_projects")
        .select("id, name, status, target_date")
        .eq("org_id", org_id)
        .in("status", ["active", "in-progress"]);

      scopeLabel = `Organization (${projects?.length ?? 0} active projects)`;
      const projectIds = projects?.map((p: { id: string }) => p.id) ?? [];

      if (projectIds.length > 0) {
        const [{ data: allTasks }, { data: allRisks }] = await Promise.all([
          supabase.from("pm_tasks").select("*").in("project_id", projectIds),
          supabase.from("pm_risks").select("*, pm_projects(name)").in("project_id", projectIds),
        ]);

        const tasks = allTasks ?? [];
        const risks = allRisks ?? [];
        const blocked = tasks.filter((t: { status: string }) => t.status === "blocked");
        const overdue = tasks.filter(
          (t: { status: string; due_date: string | null }) =>
            t.due_date && t.due_date < today && t.status !== "complete"
        );

        context = `
CROSS-PROJECT RISK SCAN — ${projects?.length ?? 0} active projects

PROJECTS:
${projects?.map((p: { name: string; status: string; target_date: string }) => `  - ${p.name} [${p.status}] target: ${p.target_date ?? "—"}`).join("\n") ?? "  None"}

ALL OPEN RISKS (${risks.filter((r: { status: string }) => r.status === "open").length}):
${risks.filter((r: { status: string }) => r.status === "open").map((r: { title: string; probability: string; impact: string; pm_projects?: { name: string } }) => `  - [${r.pm_projects?.name ?? "?"}] ${r.title} [P:${r.probability} I:${r.impact}]`).join("\n") || "  None"}

ALL BLOCKED TASKS (${blocked.length}):
${blocked.slice(0, 20).map((t: { name: string; owner: string; project_id: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"})`).join("\n") || "  None"}

ALL OVERDUE TASKS (${overdue.length}):
${overdue.slice(0, 20).map((t: { name: string; owner: string; due_date: string }) => `  - ${t.name} (owner: ${t.owner ?? "—"}, was due: ${t.due_date})`).join("\n") || "  None"}
`;
      }
      kbContext = await assembleKBContext(org_id, null);
    } else {
      return NextResponse.json({ error: "project_id or org_id required" }, { status: 400 });
    }

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are a risk management AI. Analyze the project data and generate a Risk Radar report in markdown.

Structure:
## Risk Radar — [Date]

### Critical Alerts
- Items that need immediate attention (high probability + high impact risks, severely overdue tasks, cascading blockers)

### Escalation Watch
- Risks trending toward escalation (medium→high probability, stalled tasks that may become blockers)
- Tasks overdue by 3+ days without owner response

### Dependency Chain Risks
- Blocked tasks that are blocking other work
- Phases that are stalling due to unresolved blockers

### Risk Heatmap
| Risk | Probability | Impact | Trend | Action Required |
|---|---|---|---|---|
(List each open risk with a trend indicator: ↑ escalating, → stable, ↓ improving)

### Recommended Actions
1. Numbered list of specific actions to take today
2. Each action should name the responsible person and deadline

Be specific and actionable. Flag the top 3 most urgent items first. If risks have no mitigation plan, flag that explicitly.`,
        },
        { role: "user", content: `Generate risk radar for ${scopeLabel}:\n${context}${kbContext}` },
      ],
    });

    const reportContent = response.choices[0]?.message?.content ?? "Risk radar generation failed.";

    // Save to vault if project-level
    let storagePath: string | null = null;
    if (project_id && org_slug && project_slug) {
      storagePath = `${org_slug}/${project_slug}/ai/reports/RISK-RADAR-${today}.md`;
      await writeVaultFile(
        storagePath,
        { type: "risk-radar", project: project_slug, date: today, generated: "ai" },
        reportContent
      );
      await supabase.from("pm_files").upsert(
        {
          project_id,
          storage_path: storagePath,
          file_type: "report",
          title: `Risk Radar ${today}`,
          frontmatter: { type: "risk-radar", date: today },
        },
        { onConflict: "project_id,storage_path" }
      );
    }

    return NextResponse.json({ report: reportContent, path: storagePath, date: today });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
