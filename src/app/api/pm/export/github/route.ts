import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { org_slug, project_slug } = await request.json();

    if (!org_slug) {
      return NextResponse.json({ error: "org_slug is required" }, { status: 400 });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const vaultRepo = process.env.GITHUB_VAULT_REPO;

    if (!githubToken || !vaultRepo) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN and GITHUB_VAULT_REPO must be configured" },
        { status: 500 }
      );
    }

    const supabase = createServiceClient();

    // List all files in the vault for this org (or project)
    const prefix = project_slug ? `${org_slug}/${project_slug}` : org_slug;
    const { data: files, error } = await supabase.storage
      .from("vault")
      .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Download each file and push to GitHub via the Contents API
    const [owner, repo] = vaultRepo.split("/");
    const results: { path: string; status: string }[] = [];

    for (const file of files ?? []) {
      if (!file.name.endsWith(".md")) continue;

      const filePath = `${prefix}/${file.name}`;
      const { data: blob } = await supabase.storage.from("vault").download(filePath);
      if (!blob) continue;

      const content = Buffer.from(await blob.arrayBuffer()).toString("base64");

      // Check if file exists to get its SHA
      let sha: string | undefined;
      try {
        const checkRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/vault/${filePath}`,
          { headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" } }
        );
        if (checkRes.ok) {
          const existing = await checkRes.json();
          sha = existing.sha;
        }
      } catch {
        // File doesn't exist yet
      }

      const putRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/vault/${filePath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `vault sync: ${filePath}`,
            content,
            ...(sha && { sha }),
          }),
        }
      );

      results.push({
        path: filePath,
        status: putRes.ok ? "synced" : `error: ${putRes.status}`,
      });
    }

    return NextResponse.json({
      exported: results.filter((r) => r.status === "synced").length,
      errors: results.filter((r) => r.status !== "synced").length,
      details: results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
