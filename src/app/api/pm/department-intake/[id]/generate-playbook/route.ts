import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

/**
 * POST /api/pm/department-intake/[id]/generate-playbook
 *
 * AI-generates a standardized department playbook document from the intake responses.
 * Creates a generated_document with 8 sections, each drafted from the 7-layer intake data.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch intake + department info
    const { data: intake } = await supabase
      .from("pm_department_intake")
      .select("*, pm_departments(id, name, slug, head_name, head_email)")
      .eq("id", id)
      .single();

    if (!intake) {
      return NextResponse.json({ error: "Intake form not found" }, { status: 404 });
    }

    if (intake.status === "not-started") {
      return NextResponse.json({ error: "Intake form has no responses yet" }, { status: 400 });
    }

    const dept = intake.pm_departments as { id: string; name: string; slug: string; head_name: string | null; head_email: string | null };
    const responses = intake.responses as Record<string, Record<string, string>>;

    // Get org name
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("name")
      .eq("id", intake.org_id)
      .single();

    const orgName = org?.name || "Organization";

    // Also fetch any scanned SOPs for this department
    const { data: docs } = await supabase
      .from("pm_documents")
      .select("title, description")
      .eq("org_id", intake.org_id)
      .eq("department", dept.slug)
      .limit(5);

    const existingDocs = (docs || []).map((d: { title: string; description: string | null }) => d.title).join(", ");

    // Build the AI prompt from responses
    const sections = [
      { key: "overview", title: "Department Overview", source: "vision" },
      { key: "org_roles", title: "Organizational Chart & Roles", source: "people" },
      { key: "metrics", title: "Key Metrics & Scorecard", source: "data" },
      { key: "meetings", title: "Meeting Rhythms & Communication", source: "meetings" },
      { key: "processes", title: "Core Processes & SOPs", source: "processes" },
      { key: "issues", title: "Known Issues & Resolution Plan", source: "issues" },
      { key: "automation", title: "Automation Opportunities", source: "automation" },
      { key: "action_plan", title: "Action Plan & Quick Wins", source: "all" },
    ];

    const responsesSummary = Object.entries(responses)
      .map(([pillar, answers]: [string, Record<string, string>]) => {
        const answered = Object.entries(answers)
          .filter(([, v]: [string, string]) => v && v.trim())
          .map(([q, a]: [string, string]) => `Q: ${q}\nA: ${a}`)
          .join("\n");
        return answered ? `### ${pillar.toUpperCase()}\n${answered}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a business operations consultant creating a standardized department playbook. Generate professional, actionable content for each section based on the discovery interview responses provided. Use clear headings, bullet points, and tables where appropriate. Output clean HTML.

Return JSON: {"sections": [{"key": "...", "title": "...", "content_html": "..."}]}

Generate exactly these 8 sections:
1. Department Overview — mission, purpose, how it connects to org goals
2. Organizational Chart & Roles — team structure, job descriptions, accountability
3. Key Metrics & Scorecard — KPIs to track, targets, review frequency
4. Meeting Rhythms & Communication — recurring meetings, tools, cross-dept coordination
5. Core Processes & SOPs — documented processes, workflows, handoffs
6. Known Issues & Resolution Plan — pain points, root causes, proposed fixes
7. Automation Opportunities — tasks that could be automated, ROI potential
8. Action Plan & Quick Wins — prioritized list of immediate actions`,
        },
        {
          role: "user",
          content: `Generate a department playbook for:

Organization: ${orgName}
Department: ${dept.name}
Department Head: ${dept.head_name || "Not assigned"}
${existingDocs ? `Existing SOPs: ${existingDocs}` : ""}

Discovery Interview Responses:
${responsesSummary || "No detailed responses provided — generate a template with placeholder content."}

Pillar Scores (1-5): ${JSON.stringify(intake.pillar_scores)}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    const parsed = JSON.parse(content) as {
      sections: Array<{ key: string; title: string; content_html: string }>;
    };

    // Check if a document type for playbooks exists, create if not
    let { data: docType } = await supabase
      .from("document_types")
      .select("id")
      .eq("slug", "department-playbook")
      .single();

    if (!docType) {
      const { data: newType } = await supabase
        .from("document_types")
        .insert({
          slug: "department-playbook",
          name: "Department Playbook",
          description: "Standardized department playbook with processes, metrics, and improvement plan.",
          category: "report",
          is_active: true,
          html_template: "",
          css_styles: "",
          variables: { sections: sections.map((s, i) => ({ section_key: s.key, title: s.title, sort_order: i + 1 })) },
        })
        .select()
        .single();
      docType = newType;
    }

    // Create the generated document
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .insert({
        document_type_id: docType?.id,
        org_id: intake.org_id,
        title: `${dept.name} — Department Playbook`,
        status: "draft",
        intake_data: {
          department_name: dept.name,
          department_head: dept.head_name,
          organization_name: orgName,
        },
      })
      .select()
      .single();

    if (docErr) {
      return NextResponse.json({ error: `Failed to create document: ${docErr.message}` }, { status: 500 });
    }

    // Create sections
    const sectionRows = parsed.sections.map((s: { key: string; title: string; content_html: string }, i: number) => ({
      document_id: doc.id,
      section_key: s.key,
      title: s.title,
      content_html: s.content_html,
      sort_order: i + 1,
      ai_generated: true,
    }));

    await supabase.from("document_sections").insert(sectionRows);

    // Link playbook back to department
    await supabase
      .from("pm_departments")
      .update({ playbook_document_id: doc.id })
      .eq("id", dept.id);

    // Update intake with AI summary
    const summaryText = parsed.sections
      .map((s: { title: string; content_html: string }) => `**${s.title}**: ${s.content_html.replace(/<[^>]*>/g, "").slice(0, 100)}...`)
      .join("\n");

    await supabase
      .from("pm_department_intake")
      .update({ ai_summary: summaryText })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      document_id: doc.id,
      sections_created: sectionRows.length,
      department: dept.name,
    });
  } catch (err) {
    console.error("Playbook generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
