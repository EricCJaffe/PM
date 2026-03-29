import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

/**
 * POST /api/pm/site-audit/workflow/[id]/build-prompts
 *
 * Generates structured Claude Code prompts for building the website.
 * Uses approved content, design direction, sitemap, and rubric requirements.
 *
 * Saves prompts as a project-scoped KB article for the developer to use.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch workflow
    const { data: workflow } = await supabase
      .from("pm_audit_workflows")
      .select("*")
      .eq("id", id)
      .single();

    if (!workflow || workflow.workflow_type !== "rebuild") {
      return NextResponse.json({ error: "Rebuild workflow not found" }, { status: 404 });
    }

    // Fetch audit data
    const { data: audit } = await supabase
      .from("pm_site_audits")
      .select("url, overall, scores, gaps, recommendations, pages_to_build, pages_found, audit_summary")
      .eq("id", workflow.audit_id)
      .single();

    // Fetch content tasks (with generated copy)
    const { data: contentPhase } = await supabase
      .from("pm_phases")
      .select("id")
      .eq("project_id", workflow.project_id)
      .eq("slug", "content-capture")
      .single();

    let contentTasks: Array<{ name: string; description: string }> = [];
    if (contentPhase) {
      const { data } = await supabase
        .from("pm_tasks")
        .select("name, description")
        .eq("phase_id", contentPhase.id)
        .like("name", "Content for:%")
        .order("sort_order");
      contentTasks = data || [];
    }

    // Get org info
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("name, slug")
      .eq("id", workflow.org_id)
      .single();

    const config = workflow.config as Record<string, unknown> || {};
    const intakeData = config.intake_data as Record<string, string> || {};
    const pages = (audit?.pages_to_build || []) as Array<{ slug: string; title: string; notes: string }>;

    // Generate build prompts with AI
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 6000,
      messages: [
        {
          role: "system",
          content: `You are a senior web developer writing Claude Code prompts for building a church/nonprofit website. Generate a structured set of prompts that a developer can paste into Claude Code to build the site.

Each prompt should:
- Be specific and actionable
- Reference the exact page content provided
- Include SEO requirements from the audit
- Follow Next.js 15 / App Router conventions
- Use Tailwind CSS for styling
- Include schema.org structured data where applicable

Output format: A markdown document with numbered prompts, each with a clear title and the full prompt text.`,
        },
        {
          role: "user",
          content: `Generate Claude Code build prompts for this website project:

Client: ${org?.name || "Church"}
Style: ${intakeData.style_preference || "Modern"}
Brand colors: ${intakeData.brand_colors || "To be defined"}

Pages to build:
${pages.map((p) => `- ${p.title} (${p.slug})`).join("\n")}

Page content (from approved drafts):
${contentTasks.map((t) => `### ${t.name}\n${t.description || "No content yet"}`).join("\n\n")}

Audit findings to address:
${audit?.audit_summary || "No audit summary available"}

SEO gaps to fix:
${(audit?.gaps as Record<string, Array<{ item: string; gap: string }>>)?.seo?.map((g) => `- ${g.item}: ${g.gap}`).join("\n") || "None specified"}

Requirements:
- Mobile-first responsive design
- Core Web Vitals optimized
- Schema.org Organization + Church markup
- OpenGraph meta tags on all pages
- Accessible (WCAG 2.2 AA)
- Fast page loads (lazy images, minimal JS)`,
        },
      ],
    });

    const prompts = response.choices[0]?.message?.content;
    if (!prompts) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    // Save as a project-scoped KB article
    const { data: article, error: kbErr } = await supabase
      .from("pm_kb_articles")
      .insert({
        org_id: workflow.org_id,
        project_id: workflow.project_id,
        slug: `build-prompts-${workflow.id.slice(0, 8)}`,
        title: `Build Prompts — ${org?.name || "Website"} Rebuild`,
        category: "playbook",
        content: prompts,
        tags: ["build-prompts", "claude-code", "website-rebuild"],
        is_pinned: true,
      })
      .select()
      .single();

    if (kbErr) {
      console.error("Failed to save KB article:", kbErr);
    }

    return NextResponse.json({
      success: true,
      prompts,
      kb_article_id: article?.id || null,
    });
  } catch (err) {
    console.error("Build prompt generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
