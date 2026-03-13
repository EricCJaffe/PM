import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { writeVaultFile } from "@/lib/vault";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { project_id, org_slug, project_slug } = await request.json();

    if (!project_id || !org_slug || !project_slug) {
      return NextResponse.json(
        { error: "project_id, org_slug, and project_slug are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const [
      { data: project },
      { data: phases },
      { data: tasks },
      { data: risks },
    ] = await Promise.all([
      supabase.from("pm_projects").select("*").eq("id", project_id).single(),
      supabase.from("pm_phases").select("*").eq("project_id", project_id).order("order"),
      supabase.from("pm_tasks").select("*").eq("project_id", project_id),
      supabase.from("pm_risks").select("*").eq("project_id", project_id),
    ]);

    const taskList = tasks ?? [];
    const complete = taskList.filter((t: { status: string }) => t.status === "complete").length;
    const blocked = taskList.filter((t: { status: string }) => t.status === "blocked").length;
    const inProgress = taskList.filter((t: { status: string }) => t.status === "in-progress").length;

    const context = `
Project: ${project?.name}
Status: ${project?.status}
Phases: ${phases?.length ?? 0}
Tasks: ${taskList.length} total, ${complete} complete, ${inProgress} in-progress, ${blocked} blocked
Progress: ${taskList.length > 0 ? Math.round((complete / taskList.length) * 100) : 0}%

Phase Summary:
${phases?.map((p: { order: number; name: string; status: string; progress: number; group: string }) => `P${String(p.order).padStart(2, "0")} ${p.name} [${p.group ?? ""}] — ${p.status} (${p.progress}%)`).join("\n") ?? "None"}

Blocked Tasks:
${taskList.filter((t: { status: string }) => t.status === "blocked").map((t: { name: string; owner: string; description: string }) => `- ${t.name} (owner: ${t.owner ?? "—"}): ${t.description ?? "no details"}`).join("\n") || "None"}

Open Risks:
${risks?.filter((r: { status: string }) => r.status === "open").map((r: { title: string; probability: string; impact: string }) => `- ${r.title} [${r.probability}/${r.impact}]`).join("\n") ?? "None"}
`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "You are a project management AI. Generate a concise weekly status rollup report in markdown format. Include: Executive Summary, Progress by Phase, Key Accomplishments, Blockers & Risks, Next Week Priorities.",
      messages: [{ role: "user", content: `Generate a weekly rollup for:\n${context}` }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const reportContent = textContent?.text ?? "Report generation failed.";

    const date = new Date().toISOString().split("T")[0];
    const filename = `WEEKLY-ROLLUP-${date}.md`;
    const storagePath = `${org_slug}/${project_slug}/ai/reports/${filename}`;

    await writeVaultFile(
      storagePath,
      { type: "weekly-rollup", project: project_slug, date, generated: "ai" },
      reportContent
    );

    // Index in pm_files
    await supabase.from("pm_files").upsert(
      {
        project_id,
        storage_path: storagePath,
        file_type: "report",
        title: `Weekly Rollup ${date}`,
        frontmatter: { type: "weekly-rollup", date },
      },
      { onConflict: "project_id,storage_path" }
    );

    return NextResponse.json({ report: reportContent, path: storagePath });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
