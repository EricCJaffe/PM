import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

/**
 * POST /api/pm/site-audit/workflow/[id]/generate-content
 *
 * AI-generates page content for a rebuild workflow using:
 * - Client intake data (from workflow config)
 * - Old site content (scraped during audit)
 * - Audit findings (gaps, recommendations)
 * - Page list from audit's pages_to_build
 *
 * Saves generated content as task descriptions on the content-capture phase tasks.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch workflow + audit
    const { data: workflow } = await supabase
      .from("pm_audit_workflows")
      .select("*")
      .eq("id", id)
      .single();

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (workflow.workflow_type !== "rebuild") {
      return NextResponse.json({ error: "Content generation is only for rebuild workflows" }, { status: 400 });
    }

    const { data: audit } = await supabase
      .from("pm_site_audits")
      .select("url, overall, scores, gaps, recommendations, quick_wins, pages_to_build, pages_found, raw_html, audit_summary")
      .eq("id", workflow.audit_id)
      .single();

    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    // Get the content-capture phase tasks
    const { data: contentPhase } = await supabase
      .from("pm_phases")
      .select("id")
      .eq("project_id", workflow.project_id)
      .eq("slug", "content-capture")
      .single();

    if (!contentPhase) {
      return NextResponse.json({ error: "Content capture phase not found" }, { status: 404 });
    }

    const { data: tasks } = await supabase
      .from("pm_tasks")
      .select("id, name, description")
      .eq("phase_id", contentPhase.id)
      .like("name", "Content for:%")
      .order("sort_order");

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ error: "No content tasks found" }, { status: 404 });
    }

    const config = workflow.config as Record<string, unknown> || {};
    const intakeData = config.intake_data as Record<string, string> || {};
    const pages = (audit.pages_to_build || []) as Array<{ slug: string; title: string; notes: string }>;

    // Build the AI prompt
    const openai = getOpenAI();
    let updatedCount = 0;

    // Generate content per page in batch
    const pageList = tasks.map((t) => {
      const pageName = t.name.replace("Content for: ", "");
      const pageInfo = pages.find((p) => p.title === pageName);
      return {
        taskId: t.id,
        pageName,
        slug: pageInfo?.slug || `/${pageName.toLowerCase().replace(/\s+/g, "-")}`,
        notes: pageInfo?.notes || "",
      };
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a professional web copywriter for churches and nonprofits. Generate page content for each page listed below. Use a warm, welcoming, community-focused tone. Keep copy concise — this is for a website, not a brochure.

Return JSON: {"pages": [{"page_name": "...", "hero_headline": "...", "hero_subtext": "...", "sections": [{"heading": "...", "body": "..."}], "meta_description": "...", "cta_text": "..."}]}

Each page should have:
- A compelling hero headline (5-8 words)
- Hero subtext (1-2 sentences)
- 2-4 content sections with heading + body paragraph
- A meta description (under 160 chars)
- A primary CTA button text`,
        },
        {
          role: "user",
          content: `Generate website page content for a church/organization.

Organization: ${intakeData.church_name || intakeData.client_name || "Church"}
What makes them unique: ${intakeData.unique_value || intakeData.description || "A welcoming community of faith"}
Top 3 visitor actions: ${intakeData.top_actions || "Plan a visit, Watch sermons, Give online"}
Style: ${intakeData.style_preference || "Modern and welcoming"}

Old site URL: ${audit.url}
${audit.audit_summary ? `Audit summary: ${audit.audit_summary}` : ""}

Pages to generate:
${pageList.map((p) => `- ${p.pageName} (${p.slug}): ${p.notes}`).join("\n")}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    const parsed = JSON.parse(content) as { pages: Array<{
      page_name: string;
      hero_headline: string;
      hero_subtext: string;
      sections: Array<{ heading: string; body: string }>;
      meta_description: string;
      cta_text: string;
    }> };

    // Update each task with generated content
    for (const page of parsed.pages) {
      const task = pageList.find(
        (t) => t.pageName.toLowerCase() === page.page_name.toLowerCase()
      );
      if (!task) continue;

      const htmlContent = [
        `<h3>${page.hero_headline}</h3>`,
        `<p><em>${page.hero_subtext}</em></p>`,
        ...page.sections.map((s) => `<h4>${s.heading}</h4>\n<p>${s.body}</p>`),
        `<p><strong>CTA:</strong> ${page.cta_text}</p>`,
        `<p><strong>Meta description:</strong> ${page.meta_description}</p>`,
      ].join("\n\n");

      await supabase
        .from("pm_tasks")
        .update({
          description: `AI-GENERATED DRAFT — Review and edit before finalizing.\n\n${htmlContent}`,
        })
        .eq("id", task.taskId);

      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      pages_generated: updatedCount,
    });
  } catch (err) {
    console.error("Content generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
