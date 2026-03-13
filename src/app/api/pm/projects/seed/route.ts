import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/queries";
import {
  generateProjectVaultFiles,
  generatePhaseVaultFiles,
  writeAllVaultFiles,
} from "@/lib/vault";
import { checkTablesExist } from "@/lib/db-check";

const REQUIRED_TABLES = ["pm_projects", "pm_phases", "pm_files", "pm_organizations", "pm_members"];

export async function POST(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) {
      return NextResponse.json(tableCheck, { status: 503 });
    }

    const body = await request.json();
    const {
      name,
      slug,
      description = "",
      owner = "",        // member slug, looked up from pm_members
      template_slug,
      org_id,            // preferred: pass org UUID directly
      org_slug,          // fallback: resolve org by slug
      start_date,        // optional: defaults to today
      target_date,
      budget,
    } = body;

    if (!name || !slug || !template_slug) {
      return NextResponse.json(
        { error: "name, slug, and template_slug are required" },
        { status: 400 }
      );
    }

    if (!org_id && !org_slug) {
      return NextResponse.json(
        { error: "org_id or org_slug is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Resolve org
    let resolvedOrgId = org_id;
    let resolvedOrgSlug = org_slug;

    if (!resolvedOrgId && org_slug) {
      const { data: org } = await supabase
        .from("pm_organizations")
        .select("id, slug")
        .eq("slug", org_slug)
        .single();

      if (!org) {
        return NextResponse.json(
          { error: `Organization '${org_slug}' not found. Create the organization first.` },
          { status: 404 }
        );
      }
      resolvedOrgId = org.id;
      resolvedOrgSlug = org.slug;
    } else if (resolvedOrgId && !resolvedOrgSlug) {
      const { data: org } = await supabase
        .from("pm_organizations")
        .select("slug")
        .eq("id", resolvedOrgId)
        .single();

      if (!org) {
        return NextResponse.json(
          { error: `Organization with id '${resolvedOrgId}' not found.` },
          { status: 404 }
        );
      }
      resolvedOrgSlug = org.slug;
    }

    // Validate owner exists as a member of the org (if provided)
    if (owner) {
      const { data: member } = await supabase
        .from("pm_members")
        .select("slug")
        .eq("org_id", resolvedOrgId)
        .eq("slug", owner)
        .single();

      if (!member) {
        return NextResponse.json(
          { error: `Owner '${owner}' is not a member of this organization.` },
          { status: 400 }
        );
      }
    }

    const template = await getTemplate(template_slug);
    if (!template && template_slug !== "custom") {
      return NextResponse.json({ error: `Template '${template_slug}' not found` }, { status: 404 });
    }

    const startDate = start_date || new Date().toISOString().split("T")[0];

    // 1. Create project row
    const { data: project, error: projectError } = await supabase
      .from("pm_projects")
      .insert({
        org_id: resolvedOrgId,
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
      ...generateProjectVaultFiles(resolvedOrgSlug, slug, {
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
        generatePhaseVaultFiles(resolvedOrgSlug, slug, p)
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
