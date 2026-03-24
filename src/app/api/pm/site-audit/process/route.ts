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
  let step = "init";

  try {
    const { audit_id, url, vertical, org_id, prospect_name, extra_context } = await request.json();
    auditId = audit_id;

    if (!audit_id || !url || !vertical) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!org_id && !prospect_name) {
      return NextResponse.json({ error: "org_id or prospect_name required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Safety timeout: mark as failed before Vercel kills us (maxDuration=60)
    safetyTimer = setTimeout(async () => {
      console.error(`Audit ${audit_id}: safety timeout reached (55s), last step: ${step}`);
      try {
        await createServiceClient()
          .from("pm_site_audits")
          .update({ status: "failed", audit_summary: `Audit processing timed out at step: ${step} — please try again` })
          .eq("id", audit_id)
          .eq("status", "running");
      } catch { /* last resort */ }
    }, 55_000);

    // 1. Fetch the website HTML (15s timeout)
    step = "fetch-homepage";
    let siteResponse: Response;
    try {
      siteResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BusinessOS-SiteAudit/1.0)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (fetchErr) {
      const reason = fetchErr instanceof Error ? fetchErr.message : "unknown";
      throw new Error(`Could not reach ${url} — ${reason.includes("timeout") || reason.includes("abort") ? "site took too long to respond (>15s)" : reason}`);
    }

    if (!siteResponse.ok) {
      const statusText = siteResponse.statusText || "unknown";
      throw new Error(`Site returned HTTP ${siteResponse.status} (${statusText}) — check the URL is correct and publicly accessible`);
    }

    const html = await siteResponse.text();
    if (!html || html.length < 100) {
      throw new Error(`Site returned very little content (${html.length} chars) — may be a redirect, paywall, or bot-blocker`);
    }

    // 2. Extract signals from homepage HTML
    step = "extract-signals";
    const signals = extractSignals(html, url);

    // 3. Fetch subpages + KB context + rubric in parallel
    step = "fetch-subpages";
    const [subpageContent, kbContext, rubricContent] = await Promise.all([
      fetchSiteContent(url),
      org_id ? assembleKBContext(org_id, null) : Promise.resolve(""),
      Promise.resolve(loadRubric(vertical)),
    ]);

    const subpagesSummary = subpageContent.pages
      .filter((p) => p.pathname !== "/")
      .map((p) => `=== ${p.pathname} (${p.title || "untitled"}, ${p.wordCount} words) ===\n${p.bodyText.slice(0, 1500)}`)
      .join("\n\n")
      .slice(0, 8000);

    // 4. Call GPT-4o for scoring
    step = "ai-scoring";
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildSystemPrompt(vertical, rubricContent, kbContext) },
        { role: "user", content: buildUserPrompt(signals, url, extra_context, subpagesSummary) },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 16384,
    });

    const finishReason = completion.choices[0]?.finish_reason;
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error(`AI returned empty response (finish_reason=${finishReason || "unknown"}, model=gpt-4o) — this usually means the prompt was rejected or a rate limit was hit`);
    }

    if (finishReason === "length") {
      console.warn(`Audit ${audit_id}: AI response truncated (finish_reason=length), content length=${content.length}`);
    }

    // 5. Parse AI response
    step = "parse-response";
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(content);
    } catch (parseErr) {
      // If JSON was truncated, try to salvage by closing braces
      console.error(`Audit ${audit_id}: JSON parse failed (finish_reason=${finishReason}), content length=${content.length}`);
      throw new Error(
        finishReason === "length"
          ? "AI response was too long and got truncated — try a simpler site or retry"
          : `AI returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : "parse error"}`
      );
    }

    // 6. Calculate weighted overall score
    step = "calculate-scores";
    const weights: Record<string, number> = {
      seo: 0.20, entity: 0.15, ai_discoverability: 0.20,
      conversion: 0.20, content: 0.15, a2a_readiness: 0.10,
    };

    const scores: Record<string, unknown> = {};
    for (const [dim, w] of Object.entries(weights)) {
      const rawScores = analysis.scores as Record<string, Record<string, unknown>> | undefined;
      const raw = rawScores?.[dim] || {};
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
    let rebuildRecommended = (analysis.rebuild_recommended as boolean) ?? false;
    let rebuildReason = (analysis.rebuild_reason as string) || null;

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

    // 7. Generate mockup
    step = "generate-mockup";
    const siteTitle = signals.title ? stripTags(signals.title).replace(/\s*[|\-–—].*/, "").trim() : "";
    const orgName = siteTitle || new URL(url).hostname;

    // Sanitize pages_to_build — ensure each item has slug + title strings
    const rawPagesToBuild = Array.isArray(analysis.pages_to_build) ? analysis.pages_to_build : [];
    const safePagesToBuild = (rawPagesToBuild as Array<Record<string, unknown>>).map((p) => ({
      slug: String(p.slug || p.path || p.url || "/unknown"),
      title: String(p.title || p.name || p.label || "Untitled"),
      priority: String(p.priority || "P2"),
      notes: String(p.notes || p.description || ""),
    }));

    const mockupHtml = generateMockupHtml({
      url,
      vertical: vertical as import("@/types/pm").AuditVertical,
      orgName,
      scores,
      pagesMissing: Array.isArray(analysis.pages_missing) ? (analysis.pages_missing as string[]) : [],
      pagesToBuild: safePagesToBuild,
    });

    // 8. Build subpages metadata
    step = "build-metadata";
    const subpagesFetched = subpageContent.pages
      .filter((p) => p.pathname !== "/")
      .map((p) => ({ pathname: p.pathname, title: p.title, wordCount: p.wordCount }));

    // 9. Update audit record with results
    step = "save-results";
    const { error: updateErr } = await supabase
      .from("pm_site_audits")
      .update({
        status: "complete",
        scores,
        overall,
        gaps: analysis.gaps || {},
        recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
        quick_wins: Array.isArray(analysis.quick_wins) ? analysis.quick_wins : [],
        pages_found: Array.isArray(analysis.pages_found) ? analysis.pages_found : [],
        pages_missing: Array.isArray(analysis.pages_missing) ? analysis.pages_missing : [],
        pages_to_build: safePagesToBuild,
        rebuild_timeline: Array.isArray(analysis.rebuild_timeline) ? analysis.rebuild_timeline : [],
        platform_comparison: analysis.platform_comparison || null,
        audit_summary: analysis.summary || null,
        raw_html: html.slice(0, 50000),
        mockup_html: mockupHtml,
        subpages_fetched: subpagesFetched,
      })
      .eq("id", audit_id);

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message} (code: ${updateErr.code || "unknown"}, details: ${updateErr.details || "none"})`);
    if (safetyTimer) clearTimeout(safetyTimer);
    return NextResponse.json({ success: true });

  } catch (err) {
    if (safetyTimer) clearTimeout(safetyTimer);
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const errStack = err instanceof Error ? err.stack?.split("\n").slice(0, 3).join(" | ") : "";
    const verboseMsg = `[${step}] ${errMsg}`;
    console.error(`Audit processing failed:`, verboseMsg, errStack);

    // Mark audit as failed so the frontend stops polling
    if (auditId) {
      try {
        const supabase = createServiceClient();
        await supabase
          .from("pm_site_audits")
          .update({
            status: "failed",
            audit_summary: verboseMsg,
          })
          .eq("id", auditId);
      } catch (dbErr) {
        console.error(`Failed to mark audit ${auditId} as failed:`, dbErr);
      }
    }

    return NextResponse.json(
      { error: verboseMsg, step },
      { status: 500 }
    );
  }
}
