import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { assembleKBContext } from "@/lib/kb";
import { fetchSiteContent } from "@/lib/site-fetcher";
import { generateMockupHtml } from "@/lib/audit-mockup";
import {
  extractSignals,
  stripTags,
  scoreToGrade,
  loadRubric,
  buildSystemPrompt,
  buildUserPrompt,
} from "@/lib/audit-helpers";

// Allow up to 60s on Vercel Pro (default is 10s)
export const maxDuration = 60;

// POST /api/pm/site-audit/process — Background audit processing
// Called by the frontend after creating the audit record.
export async function POST(request: NextRequest) {
  let auditId: string | null = null;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    const { audit_id, url, vertical, org_id, extra_context } = await request.json();
    auditId = audit_id;

    if (!audit_id || !url || !vertical || !org_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Safety timeout: mark as failed before Vercel kills us (maxDuration=60)
    safetyTimer = setTimeout(async () => {
      console.error(`Audit ${audit_id}: safety timeout reached (55s)`);
      try {
        await createServiceClient()
          .from("pm_site_audits")
          .update({ status: "failed", audit_summary: "Audit processing timed out — please try again" })
          .eq("id", audit_id)
          .eq("status", "running");
      } catch { /* last resort */ }
    }, 55_000);

    // 1. Fetch the website HTML (15s timeout)
    const siteResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BusinessOS-SiteAudit/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!siteResponse.ok) {
      throw new Error(`Failed to fetch site: HTTP ${siteResponse.status}`);
    }

    const html = await siteResponse.text();

    // 2. Extract signals from homepage HTML
    const signals = extractSignals(html, url);

    // 3. Fetch subpages + KB context + rubric in parallel
    const [subpageContent, kbContext, rubricContent] = await Promise.all([
      fetchSiteContent(url),
      assembleKBContext(org_id, null),
      Promise.resolve(loadRubric(vertical)),
    ]);

    const subpagesSummary = subpageContent.pages
      .filter((p) => p.pathname !== "/")
      .map((p) => `=== ${p.pathname} (${p.title || "untitled"}, ${p.wordCount} words) ===\n${p.bodyText.slice(0, 1500)}`)
      .join("\n\n")
      .slice(0, 8000);

    // 4. Call GPT-4o for scoring
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildSystemPrompt(vertical, rubricContent, kbContext) },
        { role: "user", content: buildUserPrompt(signals, url, extra_context, subpagesSummary) },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 12000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("AI returned empty response");

    const analysis = JSON.parse(content);

    // 5. Calculate weighted overall score
    const weights: Record<string, number> = {
      seo: 0.20, entity: 0.15, ai_discoverability: 0.20,
      conversion: 0.20, content: 0.15, a2a_readiness: 0.10,
    };

    const scores: Record<string, unknown> = {};
    for (const [dim, w] of Object.entries(weights)) {
      const raw = analysis.scores?.[dim] || {};
      scores[dim] = {
        grade: raw.grade || "F",
        score: typeof raw.score === "number" ? raw.score : 0,
        weight: w,
        findings: Array.isArray(raw.findings) ? raw.findings : [],
        criteria_breakdown: Array.isArray(raw.criteria_breakdown) ? raw.criteria_breakdown : [],
      };
    }

    const overallScore = Object.entries(weights).reduce((sum, [dim, w]) => {
      const dimScore = (scores[dim] as { score: number }).score;
      return sum + dimScore * w;
    }, 0);

    const overallGrade = scoreToGrade(overallScore);

    // Rebuild logic
    const aiScore = (scores.ai_discoverability as { score: number }).score;
    const contentScore = (scores.content as { score: number }).score;
    let rebuildRecommended = analysis.rebuild_recommended ?? false;
    let rebuildReason = analysis.rebuild_reason || null;

    if (overallScore < 60 && !rebuildRecommended) {
      rebuildRecommended = true;
      rebuildReason = "Overall grade is D or below — full rebuild recommended";
    }
    if (aiScore < 50 && !rebuildRecommended) {
      rebuildRecommended = true;
      rebuildReason = "AI search invisible — priority fix regardless of overall score";
    }
    if (contentScore < 40 && !rebuildRecommended) {
      rebuildRecommended = true;
      rebuildReason = "Too few pages to compete — content expansion required";
    }

    const overall = {
      grade: overallGrade,
      score: Math.round(overallScore),
      rebuild_recommended: rebuildRecommended,
      rebuild_reason: rebuildReason,
    };

    // 6. Generate mockup
    const siteTitle = signals.title ? stripTags(signals.title).replace(/\s*[|\-–—].*/, "").trim() : "";
    const orgName = siteTitle || new URL(url).hostname;
    const mockupHtml = generateMockupHtml({
      url,
      vertical: vertical as import("@/types/pm").AuditVertical,
      orgName,
      scores,
      pagesMissing: analysis.pages_missing || [],
      pagesToBuild: analysis.pages_to_build || [],
    });

    // 7. Build subpages metadata
    const subpagesFetched = subpageContent.pages
      .filter((p) => p.pathname !== "/")
      .map((p) => ({ pathname: p.pathname, title: p.title, wordCount: p.wordCount }));

    // 8. Update audit record with results
    const { error: updateErr } = await supabase
      .from("pm_site_audits")
      .update({
        status: "complete",
        scores,
        overall,
        gaps: analysis.gaps || {},
        recommendations: analysis.recommendations || [],
        quick_wins: analysis.quick_wins || [],
        pages_found: analysis.pages_found || [],
        pages_missing: analysis.pages_missing || [],
        pages_to_build: analysis.pages_to_build || [],
        rebuild_timeline: analysis.rebuild_timeline || [],
        platform_comparison: analysis.platform_comparison || null,
        audit_summary: analysis.summary,
        raw_html: html.slice(0, 50000),
        mockup_html: mockupHtml,
        subpages_fetched: subpagesFetched,
      })
      .eq("id", audit_id);

    if (updateErr) throw new Error(updateErr.message);
    if (safetyTimer) clearTimeout(safetyTimer);
    return NextResponse.json({ success: true });

  } catch (err) {
    if (safetyTimer) clearTimeout(safetyTimer);
    console.error("Audit processing failed:", err);

    // Mark audit as failed so the frontend stops polling
    if (auditId) {
      const supabase = createServiceClient();
      await supabase
        .from("pm_site_audits")
        .update({
          status: "failed",
          audit_summary: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", auditId);
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Audit processing failed" },
      { status: 500 }
    );
  }
}
