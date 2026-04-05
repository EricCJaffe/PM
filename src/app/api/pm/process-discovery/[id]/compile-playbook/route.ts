import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/pm/process-discovery/[id]/compile-playbook
 *
 * Compiles all department playbooks into a single master company playbook document.
 * Also aggregates automation opportunities across all departments.
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

    if (!workflow || workflow.workflow_type !== "process_discovery") {
      return NextResponse.json({ error: "Process discovery workflow not found" }, { status: 404 });
    }

    // Fetch all department intakes with department info
    const { data: intakes } = await supabase
      .from("pm_department_intake")
      .select("*, pm_departments(id, name, slug, playbook_document_id)")
      .eq("workflow_id", id)
      .order("created_at");

    if (!intakes || intakes.length === 0) {
      return NextResponse.json({ error: "No department intake forms found" }, { status: 400 });
    }

    // Fetch org info
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("name")
      .eq("id", workflow.org_id)
      .single();

    const orgName = org?.name || "Organization";

    // Collect all department playbook sections
    const departmentSections: Array<{
      department: string;
      sections: Array<{ title: string; content_html: string }>;
    }> = [];

    for (const intake of intakes) {
      const dept = intake.pm_departments as { id: string; name: string; slug: string; playbook_document_id: string | null };
      if (!dept.playbook_document_id) continue;

      const { data: sections } = await supabase
        .from("document_sections")
        .select("title, content_html")
        .eq("document_id", dept.playbook_document_id)
        .order("sort_order");

      if (sections && sections.length > 0) {
        departmentSections.push({
          department: dept.name,
          sections: sections as Array<{ title: string; content_html: string }>,
        });
      }
    }

    if (departmentSections.length === 0) {
      return NextResponse.json(
        { error: "No department playbooks generated yet. Generate playbooks for each department first." },
        { status: 400 }
      );
    }

    // Aggregate automation opportunities
    const { data: opportunities } = await supabase
      .from("pm_opportunities")
      .select("title, description, complexity, estimated_savings, savings_unit, priority_score, source, status")
      .eq("org_id", workflow.org_id)
      .order("priority_score", { ascending: false });

    // Build master playbook HTML
    let masterHtml = `<h1>${orgName} — Company Playbook</h1>\n`;
    masterHtml += `<p><em>Compiled from ${departmentSections.length} department playbooks</em></p>\n`;
    masterHtml += `<hr/>\n\n`;

    // Table of contents
    masterHtml += `<h2>Table of Contents</h2>\n<ol>\n`;
    for (const dept of departmentSections) {
      masterHtml += `<li><strong>${dept.department}</strong></li>\n`;
    }
    if (opportunities && opportunities.length > 0) {
      masterHtml += `<li><strong>Automation Opportunities (Organization-Wide)</strong></li>\n`;
    }
    masterHtml += `</ol>\n<hr/>\n\n`;

    // Department sections
    for (const dept of departmentSections) {
      masterHtml += `<h2>${dept.department}</h2>\n`;
      for (const section of dept.sections) {
        masterHtml += `<h3>${section.title}</h3>\n${section.content_html}\n`;
      }
      masterHtml += `<hr/>\n\n`;
    }

    // Automation opportunities summary
    if (opportunities && opportunities.length > 0) {
      masterHtml += `<h2>Automation Opportunities (Organization-Wide)</h2>\n`;
      masterHtml += `<p>${opportunities.length} opportunities identified, ranked by priority.</p>\n`;
      masterHtml += `<table><thead><tr><th>Priority</th><th>Opportunity</th><th>Complexity</th><th>Est. Savings</th><th>Status</th></tr></thead><tbody>\n`;
      for (const opp of opportunities) {
        const o = opp as { title: string; complexity: string; estimated_savings: number; savings_unit: string; priority_score: number; status: string };
        masterHtml += `<tr><td>${o.priority_score}</td><td><strong>${o.title}</strong></td><td>${o.complexity}</td><td>$${o.estimated_savings?.toLocaleString() || 0}/${o.savings_unit}</td><td>${o.status}</td></tr>\n`;
      }
      masterHtml += `</tbody></table>\n`;
    }

    // Create master playbook document
    let { data: docType } = await supabase
      .from("document_types")
      .select("id")
      .eq("slug", "master-playbook")
      .single();

    if (!docType) {
      const { data: newType } = await supabase
        .from("document_types")
        .insert({
          slug: "master-playbook",
          name: "Master Company Playbook",
          description: "Compiled playbook from all department playbooks with automation opportunities.",
          category: "report",
          is_active: true,
          html_template: "",
          css_styles: "",
          variables: {},
        })
        .select()
        .single();
      docType = newType;
    }

    const { data: masterDoc, error: docErr } = await supabase
      .from("generated_documents")
      .insert({
        document_type_id: docType?.id,
        org_id: workflow.org_id,
        project_id: workflow.project_id,
        title: `${orgName} — Master Company Playbook`,
        status: "draft",
        compiled_html: masterHtml,
        intake_data: {
          organization_name: orgName,
          departments_included: departmentSections.map((d) => d.department),
          opportunities_count: opportunities?.length || 0,
          compiled_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (docErr) {
      return NextResponse.json({ error: `Failed to create document: ${docErr.message}` }, { status: 500 });
    }

    // Create individual sections for the master doc
    const masterSections = [
      { key: "toc", title: "Table of Contents", sort: 0 },
      ...departmentSections.flatMap((dept, di) =>
        dept.sections.map((s, si) => ({
          key: `dept-${di}-${si}`,
          title: `${dept.department}: ${s.title}`,
          sort: (di + 1) * 100 + si,
          content: s.content_html,
        }))
      ),
    ];

    if (opportunities && opportunities.length > 0) {
      masterSections.push({
        key: "automation",
        title: "Automation Opportunities",
        sort: 9999,
        content: masterHtml.split("<h2>Automation Opportunities")[1] || "",
      });
    }

    const sectionRows = masterSections.map((s) => ({
      document_id: masterDoc.id,
      section_key: s.key,
      title: s.title,
      content_html: (s as { content?: string }).content || "",
      sort_order: s.sort,
    }));

    await supabase.from("document_sections").insert(sectionRows);

    return NextResponse.json({
      success: true,
      document_id: masterDoc.id,
      departments_compiled: departmentSections.length,
      opportunities_included: opportunities?.length || 0,
    });
  } catch (err) {
    console.error("Compile playbook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
