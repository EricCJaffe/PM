import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import JSZip from "jszip";
import {
  generateProjectInitMd,
  generateClientContextMd,
  generateAutomationMapMd,
  generatePromptLibraryMd,
} from "@/lib/intake-file-generator";

// POST /api/pm/engagements/[id]/project-files
// Re-generates project init files and saves them as an engagement attachment
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  // Get engagement to find linked project
  const { data: engagement, error: engErr } = await supabase
    .from("pm_engagements")
    .select("*, org:pm_organizations(slug)")
    .eq("id", id)
    .single();

  if (engErr || !engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  // Find projects linked to this engagement
  const { data: projects } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("engagement_id", id);

  if (!projects?.length) {
    return NextResponse.json({ error: "No project linked to this engagement" }, { status: 404 });
  }

  const project = projects[0];
  const orgSlug = (engagement.org as { slug: string } | null)?.slug ?? "unknown";

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
  const fileName = `${project.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}-project-files.zip`;
  const storagePath = `${orgSlug}/engagements/${id}/${Date.now()}-${fileName}`;

  const { error: uploadErr } = await supabase.storage
    .from("vault")
    .upload(storagePath, zipBuffer, { contentType: "application/zip", upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Create attachment record
  const { data: attachment, error: attErr } = await supabase
    .from("pm_engagement_attachments")
    .insert({
      engagement_id: id,
      file_name: fileName,
      file_size: zipBuffer.length,
      content_type: "application/zip",
      storage_path: storagePath,
      category: "project-files",
      description: `Project init files for ${project.name}`,
    })
    .select()
    .single();

  if (attErr) {
    return NextResponse.json({ error: attErr.message }, { status: 500 });
  }

  // Also create a signed download URL
  const { data: signedUrl } = await supabase.storage
    .from("vault")
    .createSignedUrl(storagePath, 3600);

  return NextResponse.json({
    attachment,
    download_url: signedUrl?.signedUrl ?? null,
  });
}
