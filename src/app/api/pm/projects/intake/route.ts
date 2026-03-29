import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getTemplate, isValidAssignee, resolveUniqueProjectSlug } from "@/lib/queries";
import {
  generateProjectVaultFiles,
  generatePhaseVaultFiles,
  writeAllVaultFiles,
} from "@/lib/vault";
import { checkTablesExist } from "@/lib/db-check";
import JSZip from "jszip";
import {
  generateProjectInitMd,
  generateClientContextMd,
  generateAutomationMapMd,
  generatePromptLibraryMd,
} from "@/lib/intake-file-generator";

const REQUIRED_TABLES = ["pm_projects", "pm_phases", "pm_organizations", "pm_members"];

export async function POST(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) {
      return NextResponse.json(tableCheck, { status: 503 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      name,
      slug: rawSlug,
      org_id,
      template_slug = "custom",
      owner = "",
      description = "",
      target_date,
      budget,
      engagement_id,
      intake_data = {},
      client_context = {},
    } = body;

    const slug = rawSlug || name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    if (!name || !slug || !org_id) {
      return NextResponse.json(
        { error: "name, slug (or name to derive it), and org_id are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Validate org exists
    const { data: org, error: orgErr } = await supabase
      .from("pm_organizations")
      .select("id, slug")
      .eq("id", org_id)
      .single();

    if (orgErr || !org) {
      return NextResponse.json(
        { error: `Organization not found: ${org_id}` },
        { status: 404 }
      );
    }

    // Validate owner
    if (owner) {
      const valid = await isValidAssignee(org.id, owner);
      if (!valid) {
        return NextResponse.json(
          { error: `Owner '${owner}' is not a member of this organization or site staff.` },
          { status: 400 }
        );
      }
    }

    // Resolve template
    const template = await getTemplate(template_slug);
    const safeTemplateSlug = template ? template_slug : null;

    // Deduplicate slug within org (appends -2, -3, etc. if taken)
    const uniqueSlug = await resolveUniqueProjectSlug(org.id, slug);

    // Build feature flags from intake_data
    const featureFlags: Record<string, boolean> = {
      seo_enabled: !!intake_data.seo_enabled,
      security_review: !!intake_data.security_review,
      multi_tenant: !!intake_data.multi_tenant,
      a2a_enabled: !!intake_data.a2a_enabled,
      payments_enabled: !!intake_data.payments_enabled,
      hipaa_scope: !!intake_data.hipaa_scope,
    };

    // 1. Create project row with intake data
    const startDate = new Date().toISOString().split("T")[0];
    const { data: project, error: projectError } = await supabase
      .from("pm_projects")
      .insert({
        org_id: org.id,
        slug: uniqueSlug,
        name,
        description: description || null,
        owner,
        template_slug: safeTemplateSlug,
        start_date: startDate,
        target_date: target_date || null,
        budget: budget || null,
        status: "active",
        intake_data,
        client_context,
        feature_flags: featureFlags,
        github_repo: intake_data.github_repo || null,
        vercel_project: intake_data.vercel_project || null,
        supabase_ref: intake_data.supabase_ref || null,
        engagement_id: engagement_id || null,
        intake_completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (projectError) {
      console.error("Intake project insert failed:", projectError);
      return NextResponse.json(
        { error: projectError.message },
        { status: 500 }
      );
    }

    // 2. Create phases from template (same logic as seed route)
    const phases = template?.phases ?? [];
    const phaseRows = phases.map(
      (p: { order: number; slug: string; name: string; group?: string }) => ({
        project_id: project.id,
        slug: p.slug,
        name: p.name,
        phase_order: p.order,
        group: p.group ?? null,
        status: "not-started",
        progress: 0,
      })
    );

    let insertedPhases: { id: string; slug: string }[] = [];
    let tasksCreated = 0;
    if (phaseRows.length > 0) {
      const { data: pData, error: pError } = await supabase
        .from("pm_phases")
        .insert(phaseRows)
        .select("id, slug");

      if (pError) {
        console.error("Phase insert failed:", pError);
      } else {
        insertedPhases = pData ?? [];
      }

      // Create tasks from template phases
      const phaseMap = new Map(insertedPhases.map((p) => [p.slug, p.id]));
      const taskRows: {
        project_id: string;
        org_id: string;
        phase_id: string;
        slug: string;
        name: string;
        status: string;
        sort_order: number;
      }[] = [];

      for (const phase of phases) {
        const typedPhase = phase as {
          slug: string;
          tasks?: { name: string; slug: string }[];
        };
        const phaseId = phaseMap.get(typedPhase.slug);
        if (!phaseId || !typedPhase.tasks) continue;

        for (let i = 0; i < typedPhase.tasks.length; i++) {
          const t = typedPhase.tasks[i];
          taskRows.push({
            project_id: project.id,
            phase_id: phaseId,
            org_id: org.id,
            name: t.name,
            slug: t.slug,
            status: "not-started",
            sort_order: i,
          });
        }
      }

      if (taskRows.length > 0) {
        const { error: tError } = await supabase
          .from("pm_tasks")
          .insert(taskRows);
        if (tError) {
          console.error("Task insert failed:", tError.message);
        } else {
          tasksCreated = taskRows.length;
        }
      }
    }

    // 3. Generate vault files
    try {
      const vaultFiles = [
        ...generateProjectVaultFiles(org.slug, uniqueSlug, {
          name,
          description: description || "",
          owner,
          template: template_slug,
          start: startDate,
          target: target_date || null,
          budget: budget || null,
          status: "active",
          phases: phases.map((p: { slug: string }) => p.slug),
        }),
        ...phases.flatMap(
          (p: { slug: string; name: string; order: number; group?: string }) =>
            generatePhaseVaultFiles(org.slug, uniqueSlug, p)
        ),
      ];
      const { errors } = await writeAllVaultFiles(vaultFiles);
      if (errors.length > 0) console.error("Vault write errors:", errors);
    } catch (e) {
      console.error("Vault file generation error:", e);
    }

    // 4. Link engagement → project if provided
    if (engagement_id) {
      await supabase
        .from("pm_engagements")
        .update({ project_id: project.id })
        .eq("id", engagement_id);
    }

    // 5. Generate zip with pre-filled markdown files
    const zip = new JSZip();

    zip.file(
      "PROJECT_INIT.md",
      generateProjectInitMd({
        name,
        type: (intake_data.project_type as string) ?? "other",
        isGreenfield: intake_data.is_greenfield !== false,
        v1Done: (intake_data.v1_done as string) ?? "",
        targetLaunch: target_date ?? "",
        githubRepo: (intake_data.github_repo as string) ?? "",
        vercelProject: (intake_data.vercel_project as string) ?? "",
        supabaseRef: (intake_data.supabase_ref as string) ?? "",
        framework: (intake_data.framework as string) ?? "nextjs",
        featureFlags,
        integrations: (intake_data.integrations as string[]) ?? [],
      })
    );

    zip.file(
      "CLIENT_CONTEXT.md",
      generateClientContextMd({
        orgName: name,
        problemInTheirWords: (client_context.problem_in_their_words as string) ?? "",
        whatFixedLooksLike: (client_context.what_fixed_looks_like as string) ?? "",
        technicalComfort: (client_context.technical_comfort as string) ?? "basic",
        contactName: (client_context.primary_contact_name as string) ?? "",
        contactRole: (client_context.primary_contact_role as string) ?? "",
        budgetRange: (client_context.budget_range as string) ?? "",
        hardDeadline: target_date ?? "",
        knownConstraints: (client_context.known_constraints as string) ?? "",
      })
    );

    zip.file("AUTOMATION_MAP.md", generateAutomationMapMd(name));
    zip.file("PROMPT_LIBRARY.md", generatePromptLibraryMd());

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Store zip in Supabase Storage
    const storagePath = `${org.slug}/intake/${project.id}/project-files.zip`;
    await supabase.storage
      .from("vault")
      .upload(storagePath, zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    const { data: signedUrl } = await supabase.storage
      .from("vault")
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json(
      {
        project,
        project_id: project.id,
        phases_created: insertedPhases.length,
        tasks_created: tasksCreated,
        download_url: signedUrl?.signedUrl ?? null,
        storage_path: storagePath,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Intake route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
