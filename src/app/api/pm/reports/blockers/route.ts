import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { writeVaultFile } from "@/lib/vault";
import { assembleKBContext } from "@/lib/kb";

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

    const { data: blockedTasks } = await supabase
      .from("pm_tasks")
      .select("*")
      .eq("project_id", project_id)
      .eq("status", "blocked");

    const { data: pendingTasks } = await supabase
      .from("pm_tasks")
      .select("*")
      .eq("project_id", project_id)
      .eq("status", "pending");

    const { data: risks } = await supabase
      .from("pm_risks")
      .select("*")
      .eq("project_id", project_id)
      .eq("status", "open");

    // Get project for org context
    const { data: project } = await supabase
      .from("pm_projects")
      .select("org_id")
      .eq("id", project_id)
      .single();
    const kbContext = await assembleKBContext(project?.org_id, project_id);

    const context = `
Blocked Tasks (${blockedTasks?.length ?? 0}):
${blockedTasks?.map((t: { name: string; slug: string; owner: string; description: string; depends_on: string[] }) => `- ${t.name} (${t.slug}) — owner: ${t.owner ?? "unassigned"}\n  Description: ${t.description ?? "none"}\n  Depends on: ${t.depends_on?.join(", ") ?? "none"}`).join("\n") ?? "None"}

Pending Tasks (${pendingTasks?.length ?? 0}):
${pendingTasks?.map((t: { name: string; slug: string; owner: string; depends_on: string[] }) => `- ${t.name} (${t.slug}) — waiting on: ${t.depends_on?.join(", ") ?? "unknown"}`).join("\n") ?? "None"}

Open Risks (${risks?.length ?? 0}):
${risks?.map((r: { title: string; probability: string; impact: string; mitigation: string }) => `- ${r.title} [P:${r.probability} I:${r.impact}] — Mitigation: ${r.mitigation ?? "none defined"}`).join("\n") ?? "None"}
`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        { role: "system", content: "You are a project management AI. Generate a blocker scan report in markdown. Include: Summary, Blocked Items (with recommended actions), Pending Dependencies, Risk Escalations, Recommended Next Steps." },
        { role: "user", content: `Generate blocker scan:\n${context}${kbContext}` },
      ],
    });

    const reportContent = response.choices[0]?.message?.content ?? "Report generation failed.";

    const date = new Date().toISOString().split("T")[0];
    const filename = `BLOCKER-SCAN-${date}.md`;
    const storagePath = `${org_slug}/${project_slug}/ai/reports/${filename}`;

    await writeVaultFile(
      storagePath,
      { type: "blocker-scan", project: project_slug, date, generated: "ai" },
      reportContent
    );

    await supabase.from("pm_files").upsert(
      {
        project_id,
        storage_path: storagePath,
        file_type: "report",
        title: `Blocker Scan ${date}`,
        frontmatter: { type: "blocker-scan", date },
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
