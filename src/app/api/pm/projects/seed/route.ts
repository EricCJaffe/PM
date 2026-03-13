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

    // Resolve org — always verify it exists in pm_organizations
    let resolvedOrgId = org_id || null;
    let resolvedOrgSlug = org_slug || null;

    if (resolvedOrgId) {
      // Look up org by UUID
      const { data: org, error: orgErr } = await supabase
        .from("pm_organizations")
        .select("id, slug")
        .eq("id", resolvedOrgId)
        .single();

      if (orgErr || !org) {
        return NextResponse.json(
          { error: `Organization not found. org_id="${resolvedOrgId}" does not exist in pm_organizations. Create the org first.` },
          { status: 404 }
        );
      }
      // Use the DB values to ensure consistency
      resolvedOrgId = org.id;
      resolvedOrgSlug = org.slug;
    } else if (resolvedOrgSlug) {
      // Fallback: look up org by slug
      const { data: org, error: orgErr } = await supabase
        .from("pm_organizations")
        .select("id, slug")
        .eq("slug", resolvedOrgSlug)
        .single();

      if (orgErr || !org) {
        return NextResponse.json(
          { error: `Organization '${resolvedOrgSlug}' not found. Create the organization first.` },
          { status: 404 }
        );
      }
      resolvedOrgId = org.id;
      resolvedOrgSlug = org.slug;
    } else {
      return NextResponse.json(
        { error: "org_id or org_slug is required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: `Template '${template_slug}' not found in pm_project_templates. Re-run RUN_ALL.sql to seed templates.` },
        { status: 404 }
      );
    }

    const startDate = start_date || new Date().toISOString().split("T")[0];

    // Use null for template_slug if template doesn't exist in DB (avoids FK violation)
    const safeTemplateSlug = template ? template_slug : null;

    // 1. Create project row
    const { data: project, error: projectError } = await supabase
      .from("pm_projects")
      .insert({
        org_id: resolvedOrgId,
        slug,
        name,
        description,
        owner,
        template_slug: safeTemplateSlug,
        start_date: startDate,
        target_date: target_date || null,
        budget: budget || null,
        status: "active",
      })
      .select()
      .single();

    if (projectError) {
      console.error("Project insert failed:", { org_id: resolvedOrgId, slug, template_slug, error: projectError });
      return NextResponse.json(
        { error: projectError.message, details: { org_id: resolvedOrgId, org_slug: resolvedOrgSlug, code: projectError.code } },
        { status: 500 }
      );
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
