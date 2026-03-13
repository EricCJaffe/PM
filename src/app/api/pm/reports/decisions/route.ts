import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { readVaultFile, writeVaultFile } from "@/lib/vault";

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

    // Gather all DECISIONS.md files for this project
    const { data: decisionFiles } = await supabase
      .from("pm_files")
      .select("storage_path, title")
      .eq("project_id", project_id)
      .eq("file_type", "decision");

    const allDecisions: string[] = [];

    for (const file of decisionFiles ?? []) {
      const result = await readVaultFile(file.storage_path);
      if (result?.content) {
        allDecisions.push(`## ${file.title}\n\n${result.content}`);
      }
    }

    const date = new Date().toISOString().split("T")[0];
    const registerContent = `# Decision Register: ${project_slug}\n\nGenerated: ${date}\n\n${allDecisions.join("\n\n---\n\n") || "_No decisions logged yet._"}\n`;

    const filename = `DECISION-REGISTER-${date}.md`;
    const storagePath = `${org_slug}/${project_slug}/ai/reports/${filename}`;

    await writeVaultFile(
      storagePath,
      { type: "decision-register", project: project_slug, date, generated: "ai" },
      registerContent
    );

    await supabase.from("pm_files").upsert(
      {
        project_id,
        storage_path: storagePath,
        file_type: "report",
        title: `Decision Register ${date}`,
        frontmatter: { type: "decision-register", date },
      },
      { onConflict: "project_id,storage_path" }
    );

    return NextResponse.json({ report: registerContent, path: storagePath });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
