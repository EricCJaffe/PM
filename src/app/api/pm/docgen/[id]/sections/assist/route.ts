import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

/**
 * POST /api/pm/docgen/[id]/sections/assist
 *
 * Targeted AI edit of a single section. Preserves all formatting (tables, lists, etc.).
 * Use for minor modifications — does NOT regenerate from scratch.
 *
 * Body: { section_id, instruction, content_html }
 * Returns: { content_html }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { section_id, instruction, content_html } = await request.json();

    if (!section_id || !instruction || !content_html) {
      return NextResponse.json(
        { error: "section_id, instruction, and content_html are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify the section belongs to this document
    const { data: section } = await supabase
      .from("document_sections")
      .select("id, section_key, title, document_id")
      .eq("id", section_id)
      .eq("document_id", id)
      .single();

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are editing a single section of a professional business document.
Your job is to apply targeted modifications to the section's HTML content exactly as instructed.

Rules:
- PRESERVE all existing HTML structure, tables, lists, and formatting
- Only change what the instruction asks — do not rewrite unrelated content
- Return ONLY the updated HTML content (no explanations, no markdown fences, no surrounding text)
- Keep the same professional tone and structure
- If the instruction asks to update a price or number, find and update ONLY that value
- Maintain all <table>, <tr>, <th>, <td>, <ul>, <ol>, <li>, <strong>, <em> tags as-is unless instructed otherwise`,
        },
        {
          role: "user",
          content: `Section: "${section.title}"

Current HTML content:
${content_html}

Instruction: ${instruction}

Return the updated HTML content only:`,
        },
      ],
    });

    let updatedHtml = completion.choices[0]?.message?.content?.trim() ?? "";

    // Strip any accidental markdown fences the model sometimes adds
    updatedHtml = updatedHtml
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    if (!updatedHtml) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    // Save the updated content
    await supabase
      .from("document_sections")
      .update({ content_html: updatedHtml, ai_generated: true })
      .eq("id", section_id);

    return NextResponse.json({ content_html: updatedHtml });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
