import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { assembleKBContext } from "@/lib/kb";

// GET /api/pm/site-audit?org_id=...
export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("org_id");
    if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const supabase = createServiceClient();
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

// POST /api/pm/site-audit — Run a new site audit
// Body: { org_id, url, vertical, engagement_id?, extra_context? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, url, vertical, engagement_id, extra_context } = body;

    if (!org_id || !url || !vertical) {
      return NextResponse.json({ error: "org_id, url, and vertical are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Create audit record in pending state
    const { data: audit, error: insertErr } = await supabase
      .from("pm_site_audits")
      .insert({
        org_id,
        url,
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

    try {
      // 2. Fetch the website HTML
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

      // 3. Extract key signals from HTML
      const signals = extractSignals(html, url);

      // 4. Get KB context for the org
      const kbContext = await assembleKBContext(org_id, null);

      // 5. Build AI prompt and score
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: buildSystemPrompt(vertical, kbContext) },
          { role: "user", content: buildUserPrompt(signals, url, extra_context) },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("AI returned empty response");

      const analysis = JSON.parse(content);

      // 6. Update audit record with results
      const { data: updated, error: updateErr } = await supabase
        .from("pm_site_audits")
        .update({
          status: "complete",
          scores: analysis.scores,
          gaps: analysis.gaps,
          recommendations: analysis.recommendations,
          quick_wins: analysis.quick_wins,
          pages_found: signals.pages,
          pages_to_build: analysis.pages_to_build,
          audit_summary: analysis.summary,
          raw_html: html.slice(0, 50000), // cap storage
        })
        .eq("id", audit.id)
        .select()
        .single();

      if (updateErr) throw new Error(updateErr.message);
      return NextResponse.json(updated, { status: 201 });

    } catch (err) {
      // Mark audit as failed
      await supabase
        .from("pm_site_audits")
        .update({
          status: "failed",
          audit_summary: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", audit.id);

      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Audit failed", audit_id: audit.id },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// ─── HTML Signal Extraction ─────────────────────────────────────────

interface SiteSignals {
  title: string | null;
  metaDescription: string | null;
  h1s: string[];
  h2s: string[];
  internalLinks: string[];
  externalLinks: string[];
  pages: { url: string; title: string }[];
  hasSchema: boolean;
  schemaTypes: string[];
  hasCanonical: boolean;
  hasOpenGraph: boolean;
  hasFavicon: boolean;
  hasViewport: boolean;
  images: { src: string; alt: string | null }[];
  imagesWithoutAlt: number;
  formCount: number;
  ctaTexts: string[];
  wordCount: number;
  headingStructure: string[];
}

function extractSignals(html: string, baseUrl: string): SiteSignals {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);

  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => stripTags(m[1]));
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => stripTags(m[1]));

  // Links
  const linkMatches = [...html.matchAll(/<a[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const domain = new URL(baseUrl).hostname;
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  const pages: { url: string; title: string }[] = [];

  for (const m of linkMatches) {
    const href = m[1];
    try {
      const linkUrl = new URL(href, baseUrl);
      if (linkUrl.hostname === domain || linkUrl.hostname.endsWith("." + domain)) {
        if (!internalLinks.includes(linkUrl.pathname)) {
          internalLinks.push(linkUrl.pathname);
          pages.push({ url: linkUrl.pathname, title: stripTags(m[2]).slice(0, 80) });
        }
      } else {
        externalLinks.push(linkUrl.hostname);
      }
    } catch { /* skip malformed */ }
  }

  // Schema
  const schemaBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const schemaTypes: string[] = [];
  for (const block of schemaBlocks) {
    try {
      const json = JSON.parse(block[1]);
      if (json["@type"]) schemaTypes.push(json["@type"]);
      if (Array.isArray(json["@graph"])) {
        for (const item of json["@graph"]) {
          if (item["@type"]) schemaTypes.push(item["@type"]);
        }
      }
    } catch { /* skip invalid */ }
  }

  // Images
  const imgMatches = [...html.matchAll(/<img[^>]*src=["']([^"']*)["'][^>]*/gi)];
  const images = imgMatches.map(m => ({
    src: m[1],
    alt: m[0].match(/alt=["']([^"']*)["']/i)?.[1] ?? null,
  }));

  // CTAs (buttons and links with action words)
  const btnMatches = [...html.matchAll(/<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)];
  const ctaTexts = btnMatches
    .map(m => stripTags(m[1]).trim())
    .filter(t => t.length > 0 && t.length < 60 && /contact|start|book|donate|give|visit|join|sign|schedule|get|plan|call|free/i.test(t));

  // Forms
  const formCount = (html.match(/<form/gi) || []).length;

  // Word count
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = bodyMatch ? stripTags(bodyMatch[1]) : stripTags(html);
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Heading structure
  const headingStructure = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(m => `${m[1].toUpperCase()}: ${stripTags(m[2]).slice(0, 60)}`);

  return {
    title: titleMatch ? stripTags(titleMatch[1]) : null,
    metaDescription: metaDescMatch ? metaDescMatch[1] : null,
    h1s,
    h2s,
    internalLinks,
    externalLinks,
    pages,
    hasSchema: schemaBlocks.length > 0,
    schemaTypes,
    hasCanonical: /<link[^>]*rel=["']canonical["']/i.test(html),
    hasOpenGraph: /<meta[^>]*property=["']og:/i.test(html),
    hasFavicon: /<link[^>]*rel=["'](?:shortcut )?icon["']/i.test(html),
    hasViewport: /<meta[^>]*name=["']viewport["']/i.test(html),
    images,
    imagesWithoutAlt: images.filter(i => !i.alt || i.alt.trim() === "").length,
    formCount,
    ctaTexts,
    wordCount,
    headingStructure,
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// ─── AI Prompt Builders ─────────────────────────────────────────────

function buildSystemPrompt(vertical: string, kbContext: string): string {
  return `You are a professional website auditor and digital strategist. You specialize in analyzing websites for ${vertical === "church" ? "churches and religious organizations" : vertical === "agency" ? "marketing agencies and service businesses" : vertical === "nonprofit" ? "nonprofits and charitable organizations" : "businesses"}.

You analyze websites against 6 key dimensions and provide letter grades (A-F), gap analysis, and actionable recommendations.

SCORING DIMENSIONS:
1. SEO — Title tags, meta descriptions, H1 structure, page count, internal linking, canonical tags, mobile viewport
2. Entity Authority — Name consistency, About page quality, organization schema, Google Business signals, staff/team pages
3. AI Discoverability — Structured data, FAQ content, detailed about/beliefs pages, llms.txt readiness, clear entity descriptions
4. Conversion — CTAs quality and placement, visit/contact page, service times visibility (churches), contact forms, clear value proposition
5. Content — Page count, content depth (word count), missing critical pages, blog/resources, media
6. A2A Readiness — Action-oriented schema, booking/scheduling flow, online giving/payment (churches), appointment booking, API-ready integrations

GRADING SCALE:
A = Excellent (90-100%) — Best practices followed, minimal issues
B = Good (70-89%) — Most bases covered, minor gaps
C = Average (50-69%) — Notable gaps, several improvements needed
D = Poor (30-49%) — Major deficiencies, significant work needed
F = Failing (0-29%) — Critical issues, near-complete rebuild needed

Return your analysis as a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of the site's overall state",
  "scores": {
    "seo": "A-F letter grade",
    "entity": "A-F letter grade",
    "ai_discoverability": "A-F letter grade",
    "conversion": "A-F letter grade",
    "content": "A-F letter grade",
    "a2a_readiness": "A-F letter grade"
  },
  "gaps": {
    "seo": [{"issue": "...", "severity": "critical|major|minor", "recommendation": "..."}],
    "entity": [...],
    "ai_discoverability": [...],
    "conversion": [...],
    "content": [...],
    "a2a_readiness": [...]
  },
  "recommendations": [
    {"title": "...", "priority": "high|medium|low", "effort": "quick|moderate|significant", "impact": "high|medium|low", "description": "..."}
  ],
  "quick_wins": [
    {"title": "...", "description": "..."}
  ],
  "pages_to_build": [
    {"slug": "/page-name", "title": "Page Name", "reason": "Why this page should exist"}
  ]
}

Provide 3-5 gap items per dimension, 5-8 total recommendations ordered by priority, 3-5 quick wins, and suggest any missing pages.${kbContext}`;
}

function buildUserPrompt(signals: SiteSignals, url: string, extraContext?: string | null): string {
  let prompt = `Analyze this website: ${url}

EXTRACTED SIGNALS:
- Title: ${signals.title || "(missing)"}
- Meta Description: ${signals.metaDescription || "(missing)"}
- H1 Tags: ${signals.h1s.length > 0 ? signals.h1s.join(", ") : "(none)"}
- H2 Tags: ${signals.h2s.slice(0, 10).join(", ")}${signals.h2s.length > 10 ? ` ... and ${signals.h2s.length - 10} more` : ""}
- Internal Pages Found: ${signals.internalLinks.length} (${signals.internalLinks.slice(0, 15).join(", ")})
- External Links: ${signals.externalLinks.length}
- Schema Markup: ${signals.hasSchema ? `Yes (${signals.schemaTypes.join(", ")})` : "None found"}
- Canonical Tag: ${signals.hasCanonical ? "Yes" : "No"}
- Open Graph Tags: ${signals.hasOpenGraph ? "Yes" : "No"}
- Mobile Viewport: ${signals.hasViewport ? "Yes" : "No"}
- Images: ${signals.images.length} total, ${signals.imagesWithoutAlt} without alt text
- Forms: ${signals.formCount}
- CTAs Found: ${signals.ctaTexts.length > 0 ? signals.ctaTexts.join(", ") : "(none detected)"}
- Word Count: ~${signals.wordCount}
- Heading Structure:
${signals.headingStructure.slice(0, 20).map(h => `  ${h}`).join("\n")}

PAGES DISCOVERED:
${signals.pages.slice(0, 20).map(p => `  ${p.url} — ${p.title}`).join("\n")}`;

  if (extraContext) {
    prompt += `\n\nADDITIONAL CONTEXT PROVIDED:\n${extraContext}`;
  }

  prompt += "\n\nAnalyze this site thoroughly and return the JSON analysis.";
  return prompt;
}
