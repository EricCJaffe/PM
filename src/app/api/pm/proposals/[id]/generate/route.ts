import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

// POST /api/pm/proposals/[id]/generate — AI-generate proposal content
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Get proposal with org info
    const { data: proposal, error: pErr } = await supabase
      .from("pm_proposals")
      .select("*")
      .eq("id", id)
      .single();

    if (pErr || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Get the org for client info
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("*")
      .eq("id", proposal.org_id)
      .single();

    // Get template if one is set
    let template = null;
    if (proposal.template_slug) {
      const { data: tpl } = await supabase
        .from("pm_proposal_templates")
        .select("*")
        .eq("slug", proposal.template_slug)
        .single();
      template = tpl;
    }

    const openai = getOpenAI();

    const systemPrompt = `You are a professional business document generator. Generate a polished, professional proposal document in markdown format.

${template?.boilerplate ? `Use this template as a base structure:\n\n${template.boilerplate}` : "Create a professional Statement of Work / proposal document."}

Client information:
- Company: ${org?.name || "Unknown"}
- Contact: ${org?.contact_name || "N/A"}
- Email: ${org?.contact_email || "N/A"}
- Phone: ${org?.contact_phone || "N/A"}
- Address: ${org?.address || "N/A"}

Replace all template variables ({{variable_name}}) with the provided form data values. If a variable has no corresponding form data, use a reasonable placeholder like "[TBD]".

Output clean, professional markdown. Do not include any commentary or explanations outside the document itself.`;

    const formDataStr = Object.entries(proposal.form_data || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate the proposal document "${proposal.title}" with these details:\n\n${formDataStr || "No form data provided — use reasonable defaults."}` },
      ],
      temperature: 0.3,
    });

    const generatedContent = response.choices[0]?.message?.content || "";

    // Save generated content
    const { data: updated, error: uErr } = await supabase
      .from("pm_proposals")
      .update({
        generated_content: generatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
