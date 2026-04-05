import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

/**
 * POST /api/pm/department-intake/[id]/prefill-from-scan
 *
 * Takes scanned SOP/document content and uses AI to pre-fill
 * the department intake form responses for the relevant pillars.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { document_ids } = await request.json() as { document_ids: string[] };

    if (!document_ids || document_ids.length === 0) {
      return NextResponse.json({ error: "document_ids array is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the intake form + department
    const { data: intake } = await supabase
      .from("pm_department_intake")
      .select("*, pm_departments(name, slug)")
      .eq("id", id)
      .single();

    if (!intake) {
      return NextResponse.json({ error: "Intake form not found" }, { status: 404 });
    }

    const deptName = (intake.pm_departments as { name: string }).name;

    // Fetch and extract text from each document
    let combinedText = "";
    for (const docId of document_ids.slice(0, 5)) {
      const { data: doc } = await supabase
        .from("pm_documents")
        .select("title, storage_path, mime_type")
        .eq("id", docId)
        .single();

      if (!doc) continue;

      const { data: fileData } = await supabase.storage
        .from("vault")
        .download(doc.storage_path);

      if (fileData) {
        const text = await fileData.text();
        combinedText += `\n\n--- Document: ${doc.title} ---\n${text.slice(0, 5000)}`;
      }
    }

    if (!combinedText.trim()) {
      return NextResponse.json({ error: "No document content could be extracted" }, { status: 400 });
    }

    // Truncate combined text
    if (combinedText.length > 20000) {
      combinedText = combinedText.slice(0, 20000) + "\n[...truncated]";
    }

    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are analyzing business documents to pre-fill a department discovery questionnaire. Extract relevant information and map it to the 6 pillars below. Return JSON with this structure:

{"prefilled": {
  "vision": {"department_purpose": "...", "mission_contribution": "...", ...},
  "people": {"job_descriptions": "...", "roles_clear": "...", ...},
  "data": {"current_kpis": "...", ...},
  "processes": {"top_processes": "...", "documented": "...", ...},
  "meetings": {"recurring_meetings": "...", ...},
  "issues": {"top_frustrations": "...", ...}
},
"confidence": "high|medium|low",
"notes": "brief note about what was extracted vs what needs manual input"}

Only include fields where you found clear information. Leave out fields with no data rather than guessing.`,
        },
        {
          role: "user",
          content: `Extract information for the "${deptName}" department from these documents:\n\n${combinedText}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    const parsed = JSON.parse(content) as {
      prefilled: Record<string, Record<string, string>>;
      confidence: string;
      notes: string;
    };

    // Merge pre-filled data with existing responses (don't overwrite existing answers)
    const existingResponses = (intake.responses || {}) as Record<string, Record<string, string>>;
    const merged: Record<string, Record<string, string>> = { ...existingResponses };

    for (const [pillar, answers] of Object.entries(parsed.prefilled)) {
      if (!merged[pillar]) merged[pillar] = {};
      for (const [key, value] of Object.entries(answers)) {
        // Only fill if the existing answer is empty
        if (!merged[pillar][key] || !merged[pillar][key].trim()) {
          merged[pillar][key] = value;
        }
      }
    }

    // Update the intake form
    const { data: updated, error: updateErr } = await supabase
      .from("pm_department_intake")
      .update({
        responses: merged,
        status: "in-progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fields_prefilled: Object.values(parsed.prefilled).reduce((sum, obj) => sum + Object.keys(obj).length, 0),
      confidence: parsed.confidence,
      notes: parsed.notes,
      intake: updated,
    });
  } catch (err) {
    console.error("Prefill error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
