import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import JSZip from "jszip";
import {
  generateProjectInitMd,
  generateClientContextMd,
  generateAutomationMapMd,
  generatePromptLibraryMd,
} from "@/lib/intake-file-generator";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: project, error } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get org slug
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("slug")
    .eq("id", project.org_id)
    .single();

  const intake = (project.intake_data ?? {}) as Record<string, unknown>;
  const context = (project.client_context ?? {}) as Record<string, unknown>;
  const flags = (project.feature_flags ?? {}) as Record<string, boolean>;

  const zip = new JSZip();

  zip.file(
    "PROJECT_INIT.md",
    generateProjectInitMd({
      name: project.name,
      type: (intake.project_type as string) ?? "other",
      isGreenfield: intake.is_greenfield !== false,
      v1Done: (intake.v1_done as string) ?? "[Fill in]",
      targetLaunch: project.target_date ?? "",
      githubRepo: project.github_repo ?? "",
      vercelProject: project.vercel_project ?? "",
      supabaseRef: project.supabase_ref ?? "",
      framework: (intake.framework as string) ?? "nextjs",
      featureFlags: flags,
      integrations: (intake.integrations as string[]) ?? [],
    })
  );

  zip.file(
    "CLIENT_CONTEXT.md",
    generateClientContextMd({
      orgName: project.name,
      problemInTheirWords:
        (context.problem_in_their_words as string) ?? "[Fill in from discovery call]",
      whatFixedLooksLike: (context.what_fixed_looks_like as string) ?? "[Fill in]",
      technicalComfort: (context.technical_comfort as string) ?? "basic",
      contactName: (context.primary_contact_name as string) ?? "[Fill in]",
      contactRole: (context.primary_contact_role as string) ?? "[Fill in]",
      budgetRange: (context.budget_range as string) ?? "",
      hardDeadline: project.target_date ?? "",
      knownConstraints: (context.known_constraints as string) ?? "",
    })
  );

  zip.file("AUTOMATION_MAP.md", generateAutomationMapMd(project.name));
  zip.file("PROMPT_LIBRARY.md", generatePromptLibraryMd());

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  const orgSlug = org?.slug ?? "unknown";
  const storagePath = `${orgSlug}/intake/${project.id}/project-files.zip`;

  await supabase.storage
    .from("vault")
    .upload(storagePath, zipBuffer, {
      contentType: "application/zip",
      upsert: true,
    });

  const { data: signedUrl } = await supabase.storage
    .from("vault")
    .createSignedUrl(storagePath, 3600);

  return NextResponse.json({ download_url: signedUrl?.signedUrl ?? null });
}
