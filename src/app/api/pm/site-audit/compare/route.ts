import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { getBranding, buildPreparedBy } from "@/lib/branding";
import type { AuditDimensionScore } from "@/types/pm";

const DIMS = ["seo", "entity", "ai_discoverability", "conversion", "content", "a2a_readiness"] as const;
const DIMENSION_LABELS: Record<string, string> = {
  seo: "SEO",
  entity: "Entity Authority",
  ai_discoverability: "AI Discoverability",
  conversion: "Conversion Architecture",
  content: "Content Inventory",
  a2a_readiness: "A2A Readiness",
};

// GET /api/pm/site-audit/compare?org_id=...&url=...
// Returns all snapshots for a given org+url for trend display
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const prospectName = searchParams.get("prospect_name");
    const url = searchParams.get("url");

    if (!orgId && !prospectName) {
      return NextResponse.json({ error: "org_id or prospect_name required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    let query = supabase
      .from("pm_audit_snapshots")
      .select("*")
      .order("audit_date", { ascending: true });

    if (orgId) {
      query = query.eq("org_id", orgId);
    } else {
      query = query.is("org_id", null).eq("prospect_name", prospectName!);
    }

    if (url) {
      query = query.eq("url", url);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// POST /api/pm/site-audit/compare — Compare two audits with AI analysis
// Body: { audit_id_before: string, audit_id_after: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audit_id_before, audit_id_after } = body;

    if (!audit_id_before || !audit_id_after) {
      return NextResponse.json(
        { error: "audit_id_before and audit_id_after required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch both audits
    const [beforeRes, afterRes] = await Promise.all([
      supabase
        .from("pm_site_audits")
        .select("*, pm_organizations(name, slug)")
        .eq("id", audit_id_before)
        .single(),
      supabase
        .from("pm_site_audits")
        .select("*, pm_organizations(name, slug)")
        .eq("id", audit_id_after)
        .single(),
    ]);

    if (beforeRes.error || !beforeRes.data) {
      return NextResponse.json({ error: "Before audit not found" }, { status: 404 });
    }
    if (afterRes.error || !afterRes.data) {
      return NextResponse.json({ error: "After audit not found" }, { status: 404 });
    }

    const before = beforeRes.data;
    const after = afterRes.data;

    // Build dimension comparison data
    const dimensions: Record<string, {
      label: string;
      before: { grade: string; score: number };
      after: { grade: string; score: number };
      delta: number;
      trend: "improved" | "declined" | "unchanged";
    }> = {};

    for (const d of DIMS) {
      const bDim = (before.scores || {})[d] as AuditDimensionScore | undefined;
      const aDim = (after.scores || {})[d] as AuditDimensionScore | undefined;
      const bScore = bDim?.score ?? 0;
      const aScore = aDim?.score ?? 0;
      const delta = aScore - bScore;

      dimensions[d] = {
        label: DIMENSION_LABELS[d],
        before: { grade: bDim?.grade || "F", score: bScore },
        after: { grade: aDim?.grade || "F", score: aScore },
        delta,
        trend: delta > 0 ? "improved" : delta < 0 ? "declined" : "unchanged",
      };
    }

    const overallBefore = before.overall || { grade: "F", score: 0 };
    const overallAfter = after.overall || { grade: "F", score: 0 };
    const overallDelta = (overallAfter.score || 0) - (overallBefore.score || 0);

    // AI analysis comparing the two audits
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert website analyst. Compare two site audits and provide a concise, actionable analysis. Focus on what improved, what declined, what still needs work, and prioritized next steps. Be specific about scores and findings. Return JSON.`,
        },
        {
          role: "user",
          content: `Compare these two site audits for ${after.url}:

BEFORE (${new Date(before.created_at).toISOString().split("T")[0]}):
- Overall: ${overallBefore.grade} (${overallBefore.score}%)
- Scores: ${JSON.stringify(before.scores)}
- Gaps: ${JSON.stringify(before.gaps)}
- Recommendations: ${JSON.stringify(before.recommendations)}
- Quick Wins: ${JSON.stringify(before.quick_wins)}

AFTER (${new Date(after.created_at).toISOString().split("T")[0]}):
- Overall: ${overallAfter.grade} (${overallAfter.score}%)
- Scores: ${JSON.stringify(after.scores)}
- Gaps: ${JSON.stringify(after.gaps)}
- Recommendations: ${JSON.stringify(after.recommendations)}
- Quick Wins: ${JSON.stringify(after.quick_wins)}

Return JSON with these keys:
{
  "executive_summary": "2-3 sentence overview of changes",
  "improvements": [{ "dimension": "...", "detail": "what improved and by how much" }],
  "declines": [{ "dimension": "...", "detail": "what got worse and why" }],
  "still_needs_work": [{ "dimension": "...", "detail": "remaining gap and recommended action" }],
  "next_steps": ["prioritized action item 1", "action item 2", ...],
  "overall_assessment": "1-2 sentence verdict"
}

Return ONLY valid JSON, no markdown fences.`,
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const aiContent = completion.choices[0]?.message?.content;
    let aiAnalysis = {};
    if (aiContent) {
      try { aiAnalysis = JSON.parse(aiContent); } catch { /* ignore */ }
    }

    // Resolve branding for export
    const branding = await getBranding(after.org_id || undefined);

    return NextResponse.json({
      before: {
        id: before.id,
        date: new Date(before.created_at).toISOString().split("T")[0],
        overall: overallBefore,
      },
      after: {
        id: after.id,
        date: new Date(after.created_at).toISOString().split("T")[0],
        overall: overallAfter,
      },
      overall_delta: overallDelta,
      overall_trend: overallDelta > 0 ? "improved" : overallDelta < 0 ? "declined" : "unchanged",
      dimensions,
      ai_analysis: aiAnalysis,
      org: {
        name: after.pm_organizations?.name || after.prospect_name || "",
        slug: after.pm_organizations?.slug || "",
      },
      url: after.url,
      agency_name: buildPreparedBy(branding),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
