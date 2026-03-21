import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { assembleClientUpdateData, type ClientUpdateData } from "@/lib/client-update-assembler";

// POST /api/pm/client-update/generate
export async function POST(req: NextRequest) {
  const authClient = await createServerSupabase();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { project_id, client_email, client_name, tone = "friendly" } = body;
  if (!project_id || !client_email || !client_name) {
    return NextResponse.json(
      { error: "project_id, client_email, and client_name are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Default period: last 7 days
  const periodEnd = body.period_end ?? new Date().toISOString().split("T")[0];
  const periodStartDate = new Date();
  periodStartDate.setDate(periodStartDate.getDate() - 7);
  const periodStart = body.period_start ?? periodStartDate.toISOString().split("T")[0];

  // Get project org_id
  const { data: project } = await supabase
    .from("pm_projects")
    .select("org_id, name")
    .eq("id", project_id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Assemble data
  const updateData = await assembleClientUpdateData(project_id, periodStart, periodEnd);

  // Generate with GPT-4o
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You write professional client update emails for a digital agency.
Write in ${tone} tone. Plain language only — no technical jargon.
The client is non-technical. Focus on outcomes and progress, not process.
Keep it under 280 words. Be warm but concise.`,
      },
      {
        role: "user",
        content: buildClientUpdatePrompt(client_name, updateData, tone),
      },
    ],
    max_tokens: 600,
  });

  const generatedBody = completion.choices[0]?.message?.content;
  if (!generatedBody) {
    return NextResponse.json({ error: "Failed to generate update" }, { status: 500 });
  }

  // Build subject line
  const subject = `${updateData.project_name} — Weekly Update ${formatDateRange(periodStart, periodEnd)}`;

  // Save as draft in pm_client_notes
  const { data: note, error: noteError } = await supabase
    .from("pm_client_notes")
    .insert({
      org_id: project.org_id,
      project_id,
      title: subject,
      body: generatedBody,
      note_type: "client-update",
      author: user.email ?? "Team",
      status: "draft",
      sent_to_email: client_email,
      sent_to_name: client_name,
      period_start: periodStart,
      period_end: periodEnd,
      subject,
    })
    .select()
    .single();

  if (noteError) {
    return NextResponse.json({ error: noteError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      note_id: note.id,
      subject,
      body: generatedBody,
      period_start: periodStart,
      period_end: periodEnd,
      client_email,
      client_name,
      status: "draft",
    },
    { status: 201 }
  );
}

function buildClientUpdatePrompt(
  clientName: string,
  data: ClientUpdateData,
  tone: string
): string {
  return `
Write a weekly project update email to ${clientName}.

PROJECT: ${data.project_name}
PERIOD: ${data.period_start} to ${data.period_end}
OVERALL PROGRESS: ${data.overall_progress}%
CURRENT PHASE: ${data.current_phase?.name ?? "In progress"} (${data.current_phase?.progress ?? 0}% complete)
${data.next_phase ? `NEXT PHASE: ${data.next_phase.name}` : ""}

COMPLETED THIS WEEK (${data.completed_tasks.length} items):
${
  data.completed_tasks.length > 0
    ? data.completed_tasks.map((t) => `- ${t.name}`).join("\n")
    : "- Work continued on existing items"
}

IN PROGRESS:
${
  data.in_progress_tasks.length > 0
    ? data.in_progress_tasks.slice(0, 4).map((t) => `- ${t.name}`).join("\n")
    : "- Ongoing development work"
}

${
  data.blocked_tasks.length > 0
    ? `ITEMS NEEDING CLIENT INPUT:\n${data.blocked_tasks.map((t) => `- ${t.name}`).join("\n")}`
    : ""
}

${
  data.upcoming_milestones.length > 0
    ? `COMING NEXT 2 WEEKS:\n${data.upcoming_milestones.map((t) => `- ${t.name}${t.due_date ? ` (by ${t.due_date})` : ""}`).join("\n")}`
    : ""
}

Write the email with:
1. Brief warm opening (1-2 sentences)
2. What was accomplished this week (2-4 sentences in plain language)
3. Where the project stands (1-2 sentences on progress)
4. What client input is needed, if any (only if blocked items exist)
5. What to expect next week (1-2 sentences)
6. Brief professional close

Do NOT use bullet points in the email — write in flowing paragraphs.
Do NOT mention internal tools, file names, or technical details.
Do NOT use the word "deliverables" or "sprint" or "iteration".
Write as if you are personally updating a trusted client.
Tone: ${tone}.
`;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const e = new Date(end + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${s}\u2013${e}`;
}
