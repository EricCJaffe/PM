import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { assembleKBContext } from "@/lib/kb";
import { summarizeLimiter, rateLimitExceeded } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  try {
    const { org_id, note_ids } = await request.json();

    if (!org_id) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    // SEC-005: Rate limit by org ID (20 requests/hour)
    const { success: rlOk } = await summarizeLimiter.limit(org_id);
    if (!rlOk) return rateLimitExceeded();

    const supabase = createServiceClient();

    // If specific note IDs provided, summarize those; otherwise summarize all for the org
    let query = supabase
      .from("pm_client_notes")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false });

    if (note_ids?.length) {
      query = query.in("id", note_ids);
    }

    const { data: notes, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!notes?.length) {
      return NextResponse.json({ error: "No notes found to summarize" }, { status: 404 });
    }

    // Build notes context
    const notesContext = notes
      .map(
        (n: { title: string; note_type: string; body: string | null; author: string | null; created_at: string }) =>
          `[${n.note_type.toUpperCase()}] ${n.title} (${new Date(n.created_at).toLocaleDateString()})${n.author ? ` — by ${n.author}` : ""}\n${n.body || "(no content)"}`
      )
      .join("\n\n---\n\n");

    const kbContext = await assembleKBContext(org_id);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are a business analyst AI for a project management and CRM system. Summarize client notes into a concise, actionable briefing. Include:

1. **Key Themes** — recurring topics or concerns
2. **Action Items** — tasks or follow-ups mentioned in notes
3. **Client Sentiment** — overall tone and relationship health
4. **Timeline** — important dates or deadlines mentioned
5. **Recommendations** — suggested next steps based on the notes

Keep the summary clear, professional, and focused on what matters for the account relationship. Use markdown formatting.`,
        },
        {
          role: "user",
          content: `Summarize the following ${notes.length} client note${notes.length > 1 ? "s" : ""}:\n\n${notesContext}${kbContext}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content ?? "Summary generation failed.";

    // Save summary as a client note for historical reference
    const { data: savedNote, error: saveErr } = await supabase
      .from("pm_client_notes")
      .insert({
        org_id,
        title: `AI Summary — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        body: summary,
        note_type: "general",
        visibility: "internal",
        author: "AI",
        pinned: false,
      })
      .select()
      .single();

    if (saveErr) {
      console.warn("Failed to save summary note:", saveErr.message);
    }

    return NextResponse.json({
      summary,
      note_count: notes.length,
      saved_note_id: savedNote?.id ?? null,
    });
  } catch (err) {
    console.error("Note summarization error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
