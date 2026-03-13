import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/queries";
import {
  generateProjectVaultFiles,
  generatePhaseVaultFiles,
  writeAllVaultFiles,
} from "@/lib/vault";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      slug,
      description = "",
      owner = "",
      template_slug,
      org_slug,
      target_date,
      budget,
    } = body;

    if (!name || !slug || !template_slug || !org_slug) {
      return NextResponse.json(
        { error: "name, slug, template_slug, and org_slug are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Look up or create org_id (using org_slug as a deterministic UUID for simplicity)
    // In production this would look up the actual org
    const orgId = crypto.randomUUID();

    const template = await getTemplate(template_slug);
    if (!template && template_slug !== "custom") {
      return NextResponse.json({ error: `Template '${template_slug}' not found` }, { status: 404 });
    }

    const startDate = new Date().toISOString().split("T")[0];

    // 1. Create project row
    const { data: project, error: projectError } = await supabase
      .from("pm_projects")
      .insert({
        org_id: orgId,
        slug,
        name,
        description,
        owner,
        template_slug,
        start_date: startDate,
        target_date: target_date || null,
        budget: budget || null,
        status: "active",
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // 2. Create phases from template
    const phases = template?.phases ?? [];
    const phaseRows = phases.map((p: { order: number; slug: string; name: string; group?: string }) => ({
      project_id: project.id,
      slug: p.slug,
      name: p.name,
      order: p.order,
      group: p.group ?? null,
      status: "not-started",
      progress: 0,
    }));

    if (phaseRows.length > 0) {
      const { error: phaseError } = await supabase.from("pm_phases").insert(phaseRows);
      if (phaseError) {
        console.error("Phase insert error:", phaseError.message);
      }
    }

    // 3. Generate vault files
    const vaultFiles = [
      ...generateProjectVaultFiles(org_slug, slug, {
        name,
        description,
        owner,
        template: template_slug,
        start: startDate,
        target: target_date || null,
        budget: budget || null,
        status: "active",
        phases: phases.map((p: { slug: string }) => p.slug),
      }),
      ...phases.flatMap((p: { slug: string; name: string; order: number; group?: string }) =>
        generatePhaseVaultFiles(org_slug, slug, p)
      ),
    ];

    const { errors } = await writeAllVaultFiles(vaultFiles);
    if (errors.length > 0) {
      console.error("Vault write errors:", errors);
    }

    // 4. Index vault files in pm_files
    const fileRows = vaultFiles.map((f) => ({
      project_id: project.id,
      storage_path: f.path,
      file_type: f.path.includes("/phases/")
        ? "phase"
        : f.path.includes("/tasks/")
          ? "task"
          : f.path.endsWith("PROJECT.md")
            ? "project"
            : f.path.endsWith("RISKS.md")
              ? "risk"
              : f.path.endsWith("DECISIONS.md")
                ? "decision"
                : f.path.endsWith("STATUS.md")
                  ? "status"
                  : f.path.endsWith("RESOURCES.md")
                    ? "resource"
                    : "report",
      title: f.path.split("/").pop()?.replace(".md", "") ?? "",
      frontmatter: f.frontmatter,
    }));

    if (fileRows.length > 0) {
      await supabase.from("pm_files").insert(fileRows);
    }

    return NextResponse.json({
      project,
      phases_created: phaseRows.length,
      vault_files: vaultFiles.length,
      vault_errors: errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
