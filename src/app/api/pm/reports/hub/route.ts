import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { writeVaultFile } from "@/lib/vault";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { org_slug } = await request.json();

    if (!org_slug) {
      return NextResponse.json({ error: "org_slug is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get all active projects for the org
    const { data: projects } = await supabase
      .from("pm_projects")
      .select("*")
      .eq("status", "active");

    if (!projects?.length) {
      return NextResponse.json({ report: "No active projects found.", path: null });
    }

    const projectSummaries = [];
    for (const project of projects) {
      const { data: tasks } = await supabase
        .from("pm_tasks")
        .select("status")
        .eq("project_id", project.id);

      const taskList = tasks ?? [];
      const complete = taskList.filter((t: { status: string }) => t.status === "complete").length;
      const blocked = taskList.filter((t: { status: string }) => t.status === "blocked").length;
      const progress = taskList.length > 0 ? Math.round((complete / taskList.length) * 100) : 0;

      projectSummaries.push(
        `### ${project.name}\n- Status: ${project.status}\n- Owner: ${project.owner}\n- Tasks: ${taskList.length} total, ${complete} complete, ${blocked} blocked\n- Progress: ${progress}%`
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "You are a project management AI. Generate a cross-project hub report in markdown. Include: Portfolio Overview, Project-by-Project Summary, Cross-Project Risks, Resource Conflicts, Executive Recommendations.",
      messages: [
        {
          role: "user",
          content: `Generate hub report for ${projects.length} active projects:\n\n${projectSummaries.join("\n\n")}`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const reportContent = textContent?.text ?? "Report generation failed.";

    const date = new Date().toISOString().split("T")[0];
    const filename = `HUB-REPORT-${date}.md`;
    // Store hub reports at org level
    const storagePath = `${org_slug}/ai/reports/${filename}`;

    await writeVaultFile(
      storagePath,
      { type: "hub-report", org: org_slug, date, generated: "ai" },
      reportContent
    );

    return NextResponse.json({ report: reportContent, path: storagePath });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
