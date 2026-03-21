import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assembleStandupData } from "@/lib/standup-assembler";
import { getOpenAI } from "@/lib/openai";

// POST /api/cron/standup — Vercel Cron, weekdays at 8am
export async function POST(request: NextRequest) {
  // Verify this is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get all orgs that have at least one active project
  const { data: orgs } = await supabase
    .from("pm_organizations")
    .select("id, name");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: "No orgs found" });
  }

  const results: { org: string; status: string; error?: string }[] = [];

  for (const org of orgs) {
    try {
      // Check if org has active projects before generating
      const standupData = await assembleStandupData(org.id);
      if (standupData.project_summaries.length === 0) {
        results.push({ org: org.name, status: "skipped" });
        continue;
      }

      // Generate standup via the internal generate route
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      const res = await fetch(`${appUrl}/api/pm/standup/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-cron": process.env.CRON_SECRET ?? "",
        },
        body: JSON.stringify({ org_id: org.id }),
      });

      if (res.ok) {
        results.push({ org: org.name, status: "ok" });
      } else {
        const errData = await res.json().catch(() => ({ error: "Unknown" }));
        results.push({ org: org.name, status: "failed", error: errData.error });
      }
    } catch (err) {
      results.push({ org: org.name, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ generated: results.filter((r) => r.status === "ok").length, results });
}
