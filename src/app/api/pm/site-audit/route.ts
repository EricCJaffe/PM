import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Allow up to 120s to cover the after() background processing on Vercel Pro
export const maxDuration = 120;

// GET /api/pm/site-audit?org_id=...  OR  ?prospect_name=...
export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("org_id");
    const prospectName = request.nextUrl.searchParams.get("prospect_name");

    if (!orgId && !prospectName) {
      return NextResponse.json({ error: "org_id or prospect_name required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Clean up stale audits stuck in "running" for > 5 minutes.
    // The process route has maxDuration=120s + safety timer at 110s, so any
    // audit still "running" after 5 min is truly orphaned (function was killed
    // before the safety timer could write "failed").
    const STALE_THRESHOLD_MS = 5 * 60 * 1000;
    if (orgId) {
      await supabase
        .from("pm_site_audits")
        .update({ status: "failed", audit_summary: "Audit timed out" })
        .eq("org_id", orgId)
        .eq("status", "running")
        .lt("created_at", new Date(Date.now() - STALE_THRESHOLD_MS).toISOString());
    } else if (prospectName) {
      await supabase
        .from("pm_site_audits")
        .update({ status: "failed", audit_summary: "Audit timed out" })
        .is("org_id", null)
        .eq("prospect_name", prospectName)
        .eq("status", "running")
        .lt("created_at", new Date(Date.now() - STALE_THRESHOLD_MS).toISOString());
    }

    let query = supabase
      .from("pm_site_audits")
      .select("*")
      .order("created_at", { ascending: false });

    if (orgId) {
      query = query.eq("org_id", orgId);
    } else {
      query = query.is("org_id", null).eq("prospect_name", prospectName!);
    }

    const { data, error } = await query;

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
    const { org_id, prospect_name, url, vertical, engagement_id, extra_context } = body;

    if (!url || !vertical) {
      return NextResponse.json({ error: "url and vertical are required" }, { status: 400 });
    }

    if (!org_id && !prospect_name) {
      return NextResponse.json({ error: "org_id or prospect_name is required" }, { status: 400 });
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
        org_id: org_id || null,
        prospect_name: prospect_name || null,
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

    // Schedule processing to run AFTER this response is sent.
    // This is server-side (no browser fetch), so it can't be cancelled by navigation.
    const origin = request.nextUrl.origin;
    after(async () => {
      try {
        await fetch(`${origin}/api/pm/site-audit/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audit_id: audit.id,
            url: audit.url,
            vertical: audit.vertical,
            org_id: org_id || null,
            prospect_name: prospect_name || null,
            extra_context: extra_context || null,
          }),
        });
      } catch (afterErr) {
        console.error("after(): failed to trigger audit processing:", afterErr);
      }
    });

    return NextResponse.json(audit, { status: 202 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
