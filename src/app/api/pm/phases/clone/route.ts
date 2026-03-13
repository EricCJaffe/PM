import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePhaseVaultFiles, writeAllVaultFiles } from "@/lib/vault";

export async function POST(request: NextRequest) {
  try {
    const { project_id, org_slug, project_slug, phase_name, phase_slug, order, sublayers } =
      await request.json();

    if (!project_id || !org_slug || !project_slug || !phase_name || !phase_slug) {
      return NextResponse.json(
        { error: "project_id, org_slug, project_slug, phase_name, and phase_slug are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Default sublayers for ministry discovery department
    const layers = sublayers ?? [
      "prayer",
      "vision",
      "people",
      "data",
      "process",
      "meetings",
      "issues",
    ];

    // Insert phase
    const { data: phase, error } = await supabase
      .from("pm_phases")
      .insert({
        project_id,
        slug: phase_slug,
        name: phase_name,
        order: order ?? 100,
        status: "not-started",
        progress: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate vault files for the phase
    const vaultFiles = generatePhaseVaultFiles(org_slug, project_slug, {
      slug: phase_slug,
      name: phase_name,
      order: order ?? 100,
    });

    // Add sublayer folders with STATUS/DECISIONS/RESOURCES
    const phaseFolderSlug = `p${String(order ?? 100).padStart(2, "0")}-${phase_slug}`;
    for (const layer of layers) {
      const layerBase = `${org_slug}/${project_slug}/phases/${phaseFolderSlug}/${layer}`;
      vaultFiles.push(
        {
          path: `${layerBase}/STATUS.md`,
          frontmatter: { phase: phase_slug, layer, status: "not-started", progress: 0 },
          content: `# Status: ${phase_name} — ${layer}\n\n## Current State\n- **Status:** not-started\n- **Progress:** 0%\n\n## What's Done\n\n## What's Next\n\n## Blockers\n\n## Notes\n`,
        },
        {
          path: `${layerBase}/DECISIONS.md`,
          frontmatter: { phase: phase_slug, layer },
          content: `# Decisions: ${phase_name} — ${layer}\n`,
        },
        {
          path: `${layerBase}/RESOURCES.md`,
          frontmatter: { phase: phase_slug, layer },
          content: `# Resources: ${phase_name} — ${layer}\n\n## Tools & Platforms\n\n## Reference Material\n\n## Vendor Info\n\n## Key Contacts\n`,
        }
      );
    }

    const { errors } = await writeAllVaultFiles(vaultFiles);

    return NextResponse.json({
      phase,
      sublayers: layers,
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
