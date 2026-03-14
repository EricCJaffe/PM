import { NextRequest, NextResponse } from "next/server";
import type OpenAI from "openai";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are an AI project management assistant for BusinessOS. You help manage projects stored in a Supabase database with markdown vault files.

Your capabilities:
- Answer questions about project status, tasks, phases, risks
- Suggest updates to task statuses, due dates, owners
- Help write status updates and decision logs
- Identify blockers and risks
- Generate reports and summaries

When the user asks you to make changes, describe what you would update and provide the structured data.
Format actionable responses with clear sections. Use markdown formatting.

Current project context will be provided in each message.`;

export async function POST(request: NextRequest) {
  try {
    const { project_id, project_slug, message, history = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // Fetch project context from DB
    const supabase = createServiceClient();

    const [
      { data: project },
      { data: phases },
      { data: tasks },
      { data: risks },
    ] = await Promise.all([
      supabase.from("pm_projects").select("*").eq("id", project_id).single(),
      supabase.from("pm_phases").select("*").eq("project_id", project_id).order("phase_order"),
      supabase.from("pm_tasks").select("*").eq("project_id", project_id),
      supabase.from("pm_risks").select("*").eq("project_id", project_id),
    ]);

    const context = `
Project: ${project?.name ?? project_slug} (${project?.status ?? "unknown"})
Owner: ${project?.owner ?? "unassigned"}
Template: ${project?.template_slug ?? "unknown"}
Start: ${project?.start_date ?? "—"} | Target: ${project?.target_date ?? "—"}

Phases (${phases?.length ?? 0}):
${phases?.map((p: { phase_order: number; name: string; status: string; progress: number }) => `  P${String(p.phase_order).padStart(2, "0")} ${p.name} — ${p.status} (${p.progress}%)`).join("\n") ?? "None"}

Tasks (${tasks?.length ?? 0}):
${tasks?.slice(0, 30).map((t: { name: string; status: string; owner: string; due_date: string }) => `  - ${t.name} [${t.status}] owner:${t.owner ?? "—"} due:${t.due_date ?? "—"}`).join("\n") ?? "None"}
${(tasks?.length ?? 0) > 30 ? `  ... and ${(tasks?.length ?? 0) - 30} more tasks` : ""}

Risks (${risks?.length ?? 0}):
${risks?.map((r: { title: string; probability: string; impact: string; status: string }) => `  - ${r.title} [${r.probability}/${r.impact}] ${r.status}`).join("\n") ?? "None"}
`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: `[Project Context]\n${context}\n\n[User Message]\n${message}` },
    ];

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      messages,
    });

    const responseText = response.choices[0]?.message?.content ?? "No response generated.";

    return NextResponse.json({
      response: responseText,
      metadata: {
        model: response.model,
        usage: response.usage,
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      {
        response: "I encountered an error processing your request. Please check that the OPENAI_API_KEY is configured.",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 200 } // Return 200 so the chat UI shows the error message
    );
  }
}
