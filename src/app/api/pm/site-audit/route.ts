import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/site-audit?org_id=...
export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("org_id");
    if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const supabase = createServiceClient();

    // Clean up stale audits stuck in "running" for > 3 minutes
    await supabase
      .from("pm_site_audits")
      .update({ status: "failed", audit_summary: "Audit timed out" })
      .eq("org_id", orgId)
      .eq("status", "running")
      .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    const { data, error } = await supabase
      .from("pm_site_audits")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/site-audit — Start a new site audit
// Creates the DB record and kicks off background processing.
// Returns the audit ID immediately so the frontend can poll.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, url, vertical, engagement_id, extra_context } = body;

    if (!org_id || !url || !vertical) {
      return NextResponse.json({ error: "org_id, url, and vertical are required" }, { status: 400 });
    }

    // Normalize URL — add https:// if no protocol provided
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    // Validate it's a parseable URL
    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: `Invalid URL: ${url}` }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Create audit record in running state
    const { data: audit, error: insertErr } = await supabase
      .from("pm_site_audits")
      .insert({
        org_id,
        url: normalizedUrl,
        vertical,
        engagement_id: engagement_id || null,
        extra_context: extra_context || null,
        status: "running",
      })
      .select()
      .single();

    if (insertErr || !audit) {
      return NextResponse.json({ error: insertErr?.message || "Failed to create audit" }, { status: 500 });
    }

    // Return immediately — frontend triggers processing and polls for completion
    return NextResponse.json(audit, { status: 202 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
