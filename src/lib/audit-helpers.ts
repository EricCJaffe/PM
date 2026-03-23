import { readFileSync } from "fs";
import { join } from "path";

// ─── Grade Calculation ──────────────────────────────────────────────

export function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "D-" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  if (score >= 50) return "D-";
  return "F";
}

// ─── Rubric Loader ──────────────────────────────────────────────────

const RUBRIC_FILES: Record<string, string> = {
  church: "SCORING_RUBRIC_CHURCH.md",
  agency: "SCORING_RUBRIC_AGENCY.md",
  nonprofit: "SCORING_RUBRIC_NONPROFIT.md",
};

export function loadRubric(vertical: string): string {
  const filename = RUBRIC_FILES[vertical];
  if (!filename) return "";

  try {
    const rubricPath = join(process.cwd(), "docs", "SEO", filename);
    return readFileSync(rubricPath, "utf-8");
  } catch {
    console.warn(`Could not load rubric file for vertical: ${vertical}`);
    return "";
  }
}

// ─── HTML Signal Extraction ─────────────────────────────────────────

export interface SiteSignals {
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

export function extractSignals(html: string, baseUrl: string): SiteSignals {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);

  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => stripTags(m[1]));
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => stripTags(m[1]));

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

  const imgMatches = [...html.matchAll(/<img[^>]*src=["']([^"']*)["'][^>]*/gi)];
  const images = imgMatches.map(m => ({
    src: m[1],
    alt: m[0].match(/alt=["']([^"']*)["']/i)?.[1] ?? null,
  }));

  const btnMatches = [...html.matchAll(/<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)];
  const ctaTexts = btnMatches
    .map(m => stripTags(m[1]).trim())
    .filter(t => t.length > 0 && t.length < 60 && /contact|start|book|donate|give|visit|join|sign|schedule|get|plan|call|free/i.test(t));

  const formCount = (html.match(/<form/gi) || []).length;

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = bodyMatch ? stripTags(bodyMatch[1]) : stripTags(html);
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  const headingStructure = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(m => `${m[1].toUpperCase()}: ${stripTags(m[2]).slice(0, 60)}`);

  return {
    title: titleMatch ? stripTags(titleMatch[1]) : null,
    metaDescription: metaDescMatch ? metaDescMatch[1] : null,
    h1s, h2s, internalLinks, externalLinks, pages,
    hasSchema: schemaBlocks.length > 0,
    schemaTypes,
    hasCanonical: /<link[^>]*rel=["']canonical["']/i.test(html),
    hasOpenGraph: /<meta[^>]*property=["']og:/i.test(html),
    hasFavicon: /<link[^>]*rel=["'](?:shortcut )?icon["']/i.test(html),
    hasViewport: /<meta[^>]*name=["']viewport["']/i.test(html),
    images,
    imagesWithoutAlt: images.filter(i => !i.alt || i.alt.trim() === "").length,
    formCount, ctaTexts, wordCount, headingStructure,
  };
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// ─── AI Prompt Builders ─────────────────────────────────────────────

export function buildSystemPrompt(vertical: string, rubricContent: string, kbContext: string): string {
  const verticalLabel = vertical === "church" ? "churches and religious organizations"
    : vertical === "agency" ? "marketing agencies and service businesses"
    : vertical === "nonprofit" ? "nonprofits and charitable organizations"
    : "businesses";

  const rubricSection = rubricContent
    ? `\n\nSCORING RUBRIC (use these EXACT criteria and point values — score EVERY criterion listed):\n${rubricContent}`
    : `\n\nNo specific rubric file for this vertical. Use general web standards for each dimension.`;

  return `You are an expert website auditor and digital strategist specializing in ${verticalLabel}. You produce extremely thorough, criterion-by-criterion audits that clients can act on immediately.

SCORING INSTRUCTIONS:
- Score EVERY criterion listed in the rubric individually. Do not skip or combine criteria.
- For each dimension, provide a finding for EVERY criterion in the rubric (not just 2-3 generic statements).
- Each finding must reference the specific criterion from the rubric and explain exactly what was found or missing.
- Only give full credit when a criterion is CLEARLY and FULLY met in the extracted signals.
- Give partial credit (50% of points) when a criterion is partially met.
- Give zero credit when a criterion is not met at all.
- Calculate each dimension score by summing the points earned across all criteria (out of 100).

GRADE THRESHOLDS (apply these consistently):
A = 90–100 (Best practice — minor polish only)
B = 80–89 (Strong — 1-2 specific gaps to fix)
C = 70–79 (Adequate — structural improvements needed)
D = 60–69 (Weak — significant rebuild or refactor needed)
D- = 50–59 (Poor — foundational problems throughout)
F = Below 50 (Critical — not competitive, recommend full rebuild)
${rubricSection}

Return your analysis as a JSON object with this EXACT structure:
{
  "summary": "4-6 sentence executive summary covering: overall state, biggest strengths, critical gaps, and recommended next steps",
  "scores": {
    "seo": {
      "grade": "A-F or D-",
      "score": 0-100,
      "findings": [
        "Page title (10 pts): [PASS/PARTIAL/FAIL] — Specific observation about what was found",
        "Meta description (10 pts): [PASS/PARTIAL/FAIL] — Specific observation",
        "... one finding per rubric criterion ..."
      ],
      "criteria_breakdown": [
        {"criterion": "Page title includes org name + location", "points_possible": 10, "points_earned": 10, "status": "pass", "detail": "Title is 'Church Name — City, State' — full credit"},
        {"criterion": "Meta description exists", "points_possible": 10, "points_earned": 0, "status": "fail", "detail": "No meta description tag found"}
      ]
    },
    "entity": { "grade": "...", "score": 0-100, "findings": [...], "criteria_breakdown": [...] },
    "ai_discoverability": { "grade": "...", "score": 0-100, "findings": [...], "criteria_breakdown": [...] },
    "conversion": { "grade": "...", "score": 0-100, "findings": [...], "criteria_breakdown": [...] },
    "content": { "grade": "...", "score": 0-100, "findings": [...], "criteria_breakdown": [...], "pages_found": ["/about", "/contact", ...], "pages_missing": ["/beliefs", "/visit", ...] },
    "a2a_readiness": { "grade": "...", "score": 0-100, "findings": [...], "criteria_breakdown": [...] }
  },
  "gaps": {
    "seo": [{"item": "Page title", "current_state": "Missing location — title is just 'Church Name'", "standard": "Title must include org name + city/location for local SEO", "gap": "Add city name to title tag — should be 'Church Name — City, State'"}],
    "entity": [...],
    "ai_discoverability": [...],
    "conversion": [...],
    "content": [...],
    "a2a_readiness": [...]
  },
  "recommendations": [
    {"title": "...", "priority": "high|medium|low", "effort": "quick|moderate|significant", "impact": "high|medium|low", "description": "Detailed 2-3 sentence description of what to do and why it matters"}
  ],
  "quick_wins": [
    {"action": "Change primary CTA to 'Plan Your Visit'", "time_estimate": "15 min", "impact": "Immediate conversion improvement — visitor-focused CTA outperforms generic 'Contact Us' by 3-5x"}
  ],
  "pages_found": ["/about", "/contact"],
  "pages_missing": ["/beliefs", "/visit"],
  "pages_to_build": [
    {"slug": "/visit", "title": "Plan Your Visit", "priority": "P0", "notes": "Critical for conversion — must have visit form with name, email, and family size fields"}
  ],
  "rebuild_recommended": true,
  "rebuild_reason": "Overall score below 60 with critical AI discoverability gaps — the current platform cannot support schema markup or custom page structures needed for modern web presence",
  "platform_comparison": {
    "current": "The Church Co template — limited SEO control, no schema support, cannot add custom pages",
    "recommended": "Next.js + headless CMS — full schema control, AI-optimized structure, custom pages, fast load times"
  },
  "rebuild_timeline": [
    {"phase": "Phase 1 (Week 1-2)", "focus": "Foundation", "deliverables": "Domain, hosting, CMS setup, design system, analytics"},
    {"phase": "Phase 2 (Week 3-4)", "focus": "Core Pages", "deliverables": "Home, About, Visit, Beliefs, Contact with full schema"},
    {"phase": "Phase 3 (Week 5-6)", "focus": "Content & Conversion", "deliverables": "Sermons archive, ministries pages, CTAs, forms, giving integration"},
    {"phase": "Phase 4 (Week 7-8)", "focus": "AI & SEO", "deliverables": "llms.txt, FAQ sections, structured data, GMB optimization, sitemap"}
  ]
}

DETAIL REQUIREMENTS:
- Findings: One finding per rubric criterion (8-10+ findings per dimension). Each must state the criterion, points, and pass/fail with specific evidence.
- Criteria breakdown: Score every single criterion from the rubric with points earned and specific detail.
- Gaps: 5-10 gap items per dimension, each with specific current state and actionable fix.
- Recommendations: 8-12 recommendations prioritized by impact, with detailed descriptions.
- Quick wins: 5-8 quick wins from the rubric trigger rules with realistic time estimates and specific impact.
- Pages to build: List ALL missing pages from the content inventory rubric, with specific notes for each.
- Rebuild timeline: 4-6 phases with specific deliverables if rebuild is recommended.

Be specific, not generic. Reference actual content found (or not found) on the site. Quote titles, CTAs, and page content where relevant.${kbContext}`;
}

export function buildUserPrompt(signals: SiteSignals, url: string, extraContext?: string | null, subpagesSummary?: string): string {
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

  if (subpagesSummary) {
    prompt += `\n\nSUBPAGE CONTENT (fetched additional pages for deeper analysis):\n${subpagesSummary}`;
  }

  if (extraContext) {
    prompt += `\n\nADDITIONAL CONTEXT PROVIDED:\n${extraContext}`;
  }

  prompt += "\n\nScore this site against every criterion in the rubric. Be specific about what's present and what's missing. Return the JSON analysis.";
  return prompt;
}
