import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { assembleStandupData } from "@/lib/standup-assembler";
import { sendEmail } from "@/lib/email";
import type { StandupData } from "@/types/pm";

// POST /api/pm/standup/generate
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  // Allow cron bypass via internal header
  const internalCronHeader = req.headers.get("x-internal-cron");
  const isCron = internalCronHeader === process.env.CRON_SECRET;

  if (!isCron) {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const authClient = await createServerSupabase();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { org_id, date, send_email, email_to } = body;
  if (!org_id) {
    return NextResponse.json({ error: "org_id required" }, { status: 400 });
  }

  const targetDate = date ? new Date(date) : new Date();
  const dateStr = targetDate.toISOString().split("T")[0];

  // Get org name for context
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("name")
    .eq("id", org_id)
    .single();

  // Assemble live data
  const standupData = await assembleStandupData(org_id, targetDate);

  // Build GPT-4o prompt
  const prompt = buildStandupPrompt(org?.name ?? "your organization", dateStr, standupData);

  // Generate standup content
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a project management assistant generating a concise morning standup summary. Write in plain markdown. Be direct and actionable. No fluff.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 1000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: "Failed to generate standup" }, { status: 500 });
  }

  // Save to pm_daily_logs — upsert to handle regeneration
  const { error: upsertErr } = await supabase
    .from("pm_daily_logs")
    .upsert(
      {
        project_id: null,
        org_id,
        date: dateStr,
        content,
        generated_by: "standup-agent",
        log_type: "standup",
      },
      { onConflict: "org_id,date,log_type", ignoreDuplicates: false }
    );

  // Fallback: if upsert fails (e.g. unique index not yet applied), try plain insert
  if (upsertErr) {
    console.warn("[Standup] Upsert failed, trying insert:", upsertErr.message);

    // Delete any existing standup for today first (manual dedup)
    await supabase
      .from("pm_daily_logs")
      .delete()
      .eq("org_id", org_id)
      .eq("date", dateStr)
      .eq("generated_by", "standup-agent");

    const { error: insertErr } = await supabase.from("pm_daily_logs").insert({
      project_id: null,
      org_id,
      date: dateStr,
      content,
      generated_by: "standup-agent",
      log_type: "standup",
    });

    if (insertErr) {
      console.error("[Standup] Insert also failed:", insertErr.message);
      // Last resort: try minimal insert without optional columns
      const { error: minimalErr } = await supabase.from("pm_daily_logs").insert({
        date: dateStr,
        content,
        generated_by: "standup-agent",
      });
      if (minimalErr) {
        console.error("[Standup] Minimal insert failed:", minimalErr.message);
        return NextResponse.json(
          { error: `Standup generated but failed to save: ${minimalErr.message}`, content },
          { status: 500 }
        );
      }
    }
  }

  // Send email if requested
  if (send_email && email_to) {
    const orgName = org?.name ?? "Team";
    sendEmail({
      to: email_to,
      subject: `Morning Standup — ${orgName} — ${dateStr}`,
      html: markdownToSimpleHtml(content, orgName, dateStr),
    }).catch((err) => {
      console.error("[Standup] Email send failed:", err);
    });
  }

  return NextResponse.json({
    content,
    date: dateStr,
    org_id,
    projects_covered: standupData.project_summaries.length,
    blocked_count: standupData.blocked.length,
    overdue_count: standupData.overdue.length,
  });
}

function buildStandupPrompt(orgName: string, date: string, data: StandupData): string {
  if (data.project_summaries.length === 0) {
    return `Generate a brief standup message for ${orgName} on ${date} noting there are no active projects currently tracked.`;
  }

  return `
Generate a morning standup for ${orgName} on ${date}.

ACTIVE PROJECTS (${data.project_summaries.length}):
${data.project_summaries.map((p) => `- ${p.project_name}: ${p.current_phase ?? "No current phase"} (${p.phase_progress}% complete) | Open: ${p.open_tasks} tasks | Blocked: ${p.blocked_tasks} | Overdue: ${p.overdue_tasks}`).join("\n")}

COMPLETED YESTERDAY (${data.completed_yesterday.length}):
${
  data.completed_yesterday.length > 0
    ? data.completed_yesterday.map((t) => `- ${t.task_name} [${t.project_name}]${t.owner ? ` — ${t.owner}` : ""}`).join("\n")
    : "- Nothing marked complete yesterday"
}

IN PROGRESS TODAY (${data.in_progress_today.length}):
${
  data.in_progress_today.length > 0
    ? data.in_progress_today.slice(0, 8).map((t) => `- ${t.task_name} [${t.project_name}]${t.owner ? ` — ${t.owner}` : ""}`).join("\n")
    : "- No tasks currently in progress"
}

BLOCKED (${data.blocked.length}):
${
  data.blocked.length > 0
    ? data.blocked.map((t) => `- ${t.task_name} [${t.project_name}]${t.owner ? ` — ${t.owner}` : ""}`).join("\n")
    : "- Nothing blocked"
}

DUE WITHIN 3 DAYS (${data.due_soon.length}):
${
  data.due_soon.length > 0
    ? data.due_soon.map((t) => `- ${t.task_name} [${t.project_name}] due ${t.due_date}`).join("\n")
    : "- Nothing due soon"
}

OVERDUE (${data.overdue.length}):
${
  data.overdue.length > 0
    ? data.overdue.map((t) => `- ${t.task_name} [${t.project_name}] was due ${t.due_date}`).join("\n")
    : "- Nothing overdue"
}

Write a standup covering:
## Completed Yesterday
## In Progress Today
## Blocked (if any)
## Due Soon
## Watch List (overdue items if any)

Rules:
- Use bold for project names
- Keep each section to bullet points
- Flag blocked and overdue items clearly
- No filler text — just the facts
- If a section has nothing, write "Nothing to report"
- Total length: under 400 words
`;
}

function markdownToSimpleHtml(markdown: string, orgName: string, date: string): string {
  const body = markdown
    .replace(
      /^## (.+)$/gm,
      '<h2 style="color:#1c2b1e;font-family:sans-serif;margin:20px 0 8px">$1</h2>'
    )
    .replace(
      /^- (.+)$/gm,
      '<li style="font-family:sans-serif;font-size:14px;color:#333;line-height:1.6">$1</li>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br/>");

  return `
    <div style="max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#1c2b1e;padding:16px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:#e8dfc8;font-family:sans-serif;font-size:18px;margin:0">
          Morning Standup — ${orgName}
        </h1>
        <p style="color:#7a9070;font-family:sans-serif;font-size:13px;margin:4px 0 0">${date}</p>
      </div>
      <div style="background:#faf9f6;padding:24px;border:1px solid #ddd8cc;border-top:none;border-radius:0 0 8px 8px">
        ${body}
      </div>
    </div>
  `;
}
