import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { assembleKBContext } from "@/lib/kb";

// POST /api/pm/docgen/[id]/generate — AI-generate document sections
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const sectionKeys: string[] | undefined = body.section_keys; // optional: generate specific sections only

    const supabase = createServiceClient();

    // Fetch document + type + intake fields
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("*, document_types(name, slug, variables)")
      .eq("id", id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const docType = (doc as Record<string, unknown>).document_types as {
      name: string;
      slug: string;
      variables: Record<string, unknown>;
    } | null;

    // Get intake fields with AI hints
    const { data: intakeFields } = await supabase
      .from("document_intake_fields")
      .select("field_key, label, ai_hint, section")
      .eq("document_type_id", doc.document_type_id)
      .order("sort_order");

    // Get existing sections
    const { data: existingSections } = await supabase
      .from("document_sections")
      .select("*")
      .eq("document_id", id)
      .order("sort_order");

    // Filter to requested sections (or all unlocked)
    const sectionsToGenerate = (existingSections ?? []).filter((s: Record<string, unknown>) => {
      if (s.is_locked) return false;
      if (sectionKeys?.length) return sectionKeys.includes(s.section_key as string);
      return true;
    });

    if (!sectionsToGenerate.length) {
      return NextResponse.json({ error: "No sections to generate (all locked or none found)" }, { status: 400 });
    }

    // Build AI prompt
    const intakeData = doc.intake_data as Record<string, string>;
    const fieldHints = (intakeFields ?? [])
      .filter((f: Record<string, unknown>) => intakeData[f.field_key as string])
      .map((f: Record<string, unknown>) => {
        const hint = f.ai_hint ? ` (${f.ai_hint})` : "";
        return `- ${f.label}: ${intakeData[f.field_key as string]}${hint}`;
      })
      .join("\n");

    const sectionList = sectionsToGenerate
      .map((s: Record<string, unknown>) => `  - section_key: "${s.section_key}", title: "${s.title}"`)
      .join("\n");

    const kbContext = await assembleKBContext(doc.org_id as string | null, doc.project_id as string | null);

    const systemPrompt = `You are a professional document writer creating a ${docType?.name ?? "document"}.
Write polished, professional content suitable for client-facing business documents.
Use clear, concise business language. Format with HTML tags (p, ul, ol, li, table, tr, th, td, strong, em).
Do NOT include the section title as an h2 — just the body content.${kbContext}`;

    const userPrompt = `Generate content for the following sections of a "${docType?.name ?? "Document"}" based on the intake data below.

INTAKE DATA:
${fieldHints}

SECTIONS TO GENERATE:
${sectionList}

Return a JSON object where each key is the section_key and the value is the HTML content for that section.
Example: { "executive_summary": "<p>Content here...</p>", "scope_of_work": "<ul><li>Item</li></ul>" }

Important:
- Write professional, polished content appropriate for a formal business document
- Use the intake data to inform the content — expand abbreviations, add professional context
- For pricing sections, create HTML tables with clear formatting
- For timeline sections, create milestone tables
- For scope sections, use bulleted lists
- Each section should be substantive (2-4 paragraphs or equivalent structured content)
- Return ONLY valid JSON, no markdown fences`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    let generatedSections: Record<string, string>;
    try {
      generatedSections = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // Update sections in DB
    for (const section of sectionsToGenerate) {
      const sectionKey = section.section_key as string;
      const html = generatedSections[sectionKey];
      if (html) {
        await supabase
          .from("document_sections")
          .update({ content_html: html, ai_generated: true })
          .eq("id", section.id);
      }
    }

    // Log activity
    await supabase.from("document_activity").insert({
      document_id: id,
      action: "generated",
      details: { sections: sectionsToGenerate.map((s: Record<string, unknown>) => s.section_key) },
    });

    // Return updated sections
    const { data: updated } = await supabase
      .from("document_sections")
      .select("*")
      .eq("document_id", id)
      .order("sort_order");

    return NextResponse.json({ sections: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
