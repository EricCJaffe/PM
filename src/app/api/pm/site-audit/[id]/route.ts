import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

// GET /api/pm/site-audit/[id] — fetch a single audit
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("pm_site_audits")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// DELETE /api/pm/site-audit/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase.from("pm_site_audits").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/site-audit/[id] — generate document from audit results
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch the audit
    const { data: audit, error: auditErr } = await supabase
      .from("pm_site_audits")
      .select("*")
      .eq("id", id)
      .single();

    if (auditErr || !audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    if (audit.status !== "complete") {
      return NextResponse.json({ error: "Audit is not complete" }, { status: 400 });
    }

    // Find or create the site-audit document type
    let { data: docType } = await supabase
      .from("document_types")
      .select("id")
      .eq("slug", "site-audit-report")
      .single();

    if (!docType) {
      const { data: created, error: typeErr } = await supabase
        .from("document_types")
        .insert({
          name: "Site Audit Report",
          slug: "site-audit-report",
          description: "Website audit gap analysis and recommendations report",
          category: "report",
          html_template: AUDIT_HTML_TEMPLATE,
          css_styles: AUDIT_CSS,
        })
        .select("id")
        .single();

      if (typeErr || !created) {
        return NextResponse.json({ error: "Failed to create document type" }, { status: 500 });
      }
      docType = created;
    }

    // Create the generated document
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .insert({
        document_type_id: docType.id,
        org_id: audit.org_id,
        title: `Site Audit — ${audit.url}`,
        status: "draft",
        intake_data: {
          url: audit.url,
          vertical: audit.vertical,
          audit_id: audit.id,
        },
      })
      .select()
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
    }

    // Generate section content from audit data using AI
    const openai = getOpenAI();
    const scores = audit.scores as Record<string, string>;
    const gaps = audit.gaps as Record<string, Array<{ issue: string; severity: string; recommendation: string }>>;
    const recommendations = audit.recommendations as Array<{ title: string; priority: string; description: string }>;
    const quickWins = audit.quick_wins as Array<{ title: string; description: string }>;
    const pagesToBuild = audit.pages_to_build as Array<{ slug: string; title: string; reason: string }>;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional document writer. Generate polished HTML content for a site audit report.
Write professional, client-facing content. Use HTML tags (p, ul, ol, li, table, tr, th, td, strong, em, h3).
Do NOT include h2 section headings — just the body content for each section.
Return a JSON object where keys are section_key strings and values are HTML strings.`,
        },
        {
          role: "user",
          content: `Generate the following sections for a site audit report of ${audit.url} (${audit.vertical} vertical):

AUDIT DATA:
- Summary: ${audit.audit_summary}
- Scores: ${JSON.stringify(scores)}
- Gaps: ${JSON.stringify(gaps)}
- Recommendations: ${JSON.stringify(recommendations)}
- Quick Wins: ${JSON.stringify(quickWins)}
- Pages to Build: ${JSON.stringify(pagesToBuild)}

SECTIONS TO GENERATE:
1. "executive_summary" — High-level overview of findings, overall grade, key takeaways
2. "score_card" — Visual scorecard table with all 6 dimensions, grades, and brief explanations
3. "gap_analysis" — Detailed gap analysis organized by dimension with severity indicators
4. "recommendations" — Prioritized list of recommendations with effort/impact ratings
5. "quick_wins" — Immediate actions that can be taken right away
6. "site_structure" — Recommended page structure / pages to build
7. "next_steps" — Proposed engagement next steps and timeline

Return ONLY valid JSON, no markdown fences.`,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("AI returned empty response");

    const sections = JSON.parse(content);

    // Insert document sections
    const sectionDefs = [
      { key: "executive_summary", title: "Executive Summary", order: 1 },
      { key: "score_card", title: "Score Card", order: 2 },
      { key: "gap_analysis", title: "Gap Analysis", order: 3 },
      { key: "recommendations", title: "Recommendations", order: 4 },
      { key: "quick_wins", title: "Quick Wins", order: 5 },
      { key: "site_structure", title: "Recommended Site Structure", order: 6 },
      { key: "next_steps", title: "Next Steps", order: 7 },
    ];

    for (const def of sectionDefs) {
      await supabase.from("document_sections").insert({
        document_id: doc.id,
        section_key: def.key,
        title: def.title,
        content_html: sections[def.key] || "<p>Content pending generation.</p>",
        sort_order: def.order,
        ai_generated: true,
      });
    }

    // Link audit to document
    await supabase
      .from("pm_site_audits")
      .update({ document_id: doc.id })
      .eq("id", audit.id);

    return NextResponse.json({ document_id: doc.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// ─── Templates ──────────────────────────────────────────────────────

const AUDIT_HTML_TEMPLATE = `<div class="audit-report">
  <div class="report-header">
    <h1>Website Audit Report</h1>
    <p class="subtitle">{{url}} — {{vertical}} Standards</p>
  </div>
  {{#each sections}}{{/each}}
</div>`;

const AUDIT_CSS = `
.audit-report { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; }
.report-header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e2e8f0; }
.report-header h1 { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.5rem; }
.report-header .subtitle { color: #64748b; font-size: 1rem; }
.section { margin-bottom: 2rem; }
.section h2 { font-size: 1.25rem; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem; }
.section-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
.section-content th, .section-content td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.875rem; }
.section-content th { background: #f1f5f9; font-weight: 600; }
.section-content ul, .section-content ol { padding-left: 1.5rem; margin: 0.5rem 0; }
.section-content li { margin: 0.25rem 0; }
.section-content p { margin: 0.5rem 0; line-height: 1.6; }
@media print { .audit-report { max-width: none; } }
`;
