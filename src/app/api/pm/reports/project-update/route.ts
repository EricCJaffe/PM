import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { getBranding, buildPreparedBy } from "@/lib/branding";
import { assembleKBContext } from "@/lib/kb";
import { reportLimiter, rateLimitExceeded } from "@/lib/ratelimit";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function statusBadge(status: string, navy: string): string {
  const colors: Record<string, string> = {
    complete: "#16a34a",
    "in-progress": "#2563eb",
    blocked: "#dc2626",
    pending: "#d97706",
    "not-started": "#6b7280",
    "on-hold": "#7c3aed",
  };
  const color = colors[status] ?? "#6b7280";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${color}20;color:${color};border:1px solid ${color}40">${esc(status)}</span>`;
}

function scheduleStatus(project: { start_date: string; target_date: string | null; status: string }, progress: number): {
  label: string;
  color: string;
  detail: string;
} {
  if (!project.target_date) return { label: "No target date set", color: "#6b7280", detail: "" };

  const now = Date.now();
  const start = new Date(project.start_date).getTime();
  const target = new Date(project.target_date).getTime();
  const totalDuration = target - start;
  const elapsed = now - start;
  const timeProgress = totalDuration > 0 ? Math.min((elapsed / totalDuration) * 100, 100) : 0;
  const daysRemaining = Math.ceil((target - now) / 86400000);

  const delta = progress - timeProgress;

  if (project.status === "complete") return { label: "Complete", color: "#16a34a", detail: "Project marked complete" };
  if (daysRemaining < 0) return { label: "Overdue", color: "#dc2626", detail: `${Math.abs(daysRemaining)} days past target` };
  if (delta >= 5) return { label: "Ahead of Schedule", color: "#16a34a", detail: `${daysRemaining} days remaining, ${Math.round(delta)}% ahead` };
  if (delta <= -10) return { label: "Behind Schedule", color: "#dc2626", detail: `${daysRemaining} days remaining, ${Math.round(Math.abs(delta))}% behind` };
  return { label: "On Track", color: "#d97706", detail: `${daysRemaining} days remaining` };
}

export async function POST(request: NextRequest) {
  try {
    const { project_id } = await request.json();
    if (!project_id) return NextResponse.json({ error: "project_id is required" }, { status: 400 });

    const { success: rlOk } = await reportLimiter.limit(project_id);
    if (!rlOk) return rateLimitExceeded();

    const supabase = createServiceClient();

    const { data: project } = await supabase
      .from("pm_projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const [
      { data: phases },
      { data: tasks },
      { data: risks },
      { data: orgData },
    ] = await Promise.all([
      supabase.from("pm_phases").select("*").eq("project_id", project_id).order("phase_order"),
      supabase.from("pm_tasks").select("*").eq("project_id", project_id),
      supabase.from("pm_risks").select("*").eq("project_id", project_id),
      supabase.from("pm_organizations").select("name").eq("id", project.org_id).single(),
    ]);

    const taskList = tasks ?? [];
    const phaseList = phases ?? [];
    const riskList = risks ?? [];
    const complete = taskList.filter((t: { status: string }) => t.status === "complete").length;
    const blocked = taskList.filter((t: { status: string }) => t.status === "blocked").length;
    const inProgress = taskList.filter((t: { status: string }) => t.status === "in-progress").length;
    const notStarted = taskList.filter((t: { status: string }) => t.status === "not-started").length;
    const pending = taskList.filter((t: { status: string }) => t.status === "pending").length;
    const progress = taskList.length > 0 ? Math.round((complete / taskList.length) * 100) : 0;
    const openRisks = riskList.filter((r: { status: string }) => r.status === "open");
    const schedule = scheduleStatus(project, progress);

    const context = `
Project: ${project.name}
Client: ${orgData?.name ?? "—"}
Status: ${project.status}
Start: ${project.start_date}  Target: ${project.target_date ?? "TBD"}
Progress: ${progress}% (${complete}/${taskList.length} tasks complete)
Schedule: ${schedule.label} — ${schedule.detail}

Phases (${phaseList.length}):
${phaseList.map((p: { phase_order: number; name: string; status: string; group?: string }) =>
  `  P${String(p.phase_order).padStart(2, "0")} ${p.name} [${p.group ?? ""}] — ${p.status}`
).join("\n")}

Task Breakdown:
  Complete: ${complete}
  In Progress: ${inProgress}
  Blocked: ${blocked}
  Pending: ${pending}
  Not Started: ${notStarted}

Blocked tasks:
${taskList.filter((t: { status: string }) => t.status === "blocked").map((t: { name: string; owner?: string }) => `  - ${t.name} (${t.owner ?? "unassigned"})`).join("\n") || "  None"}

Open Risks (${openRisks.length}):
${openRisks.map((r: { title: string; probability: string; impact: string }) => `  - ${r.title} [probability: ${r.probability}, impact: ${r.impact}]`).join("\n") || "  None"}
`;

    const kbContext = await assembleKBContext(project.org_id, project_id);

    const aiResponse = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content: "You are a senior project manager writing a concise executive project status update for a client and leadership team. Write in clear, professional prose — not bullet points. Be honest about risks and blockers.",
        },
        {
          role: "user",
          content: `Generate a project status report with these sections:

1. EXECUTIVE SUMMARY (3-4 sentences): Overall health, schedule status, key headline, and confidence level.
2. WHAT'S DONE: Key completed milestones and their business impact (3-5 items).
3. WHAT'S IN PROGRESS: Active work items and expected completion (3-5 items).
4. RISKS & BLOCKERS: Honest assessment of open risks, blocked tasks, and recommended actions.
5. NEXT STEPS: Top 3-5 priorities for the next period.

Project data:
${context}${kbContext}

Write in flowing paragraphs for the executive summary. Use short crisp bullets for the other sections. Keep the total under 600 words.`,
        },
      ],
    });

    const aiContent = aiResponse.choices[0]?.message?.content ?? "";

    // Parse AI sections
    function extractSection(content: string, header: string, nextHeaders: string[]): string {
      const pattern = new RegExp(`(?:#+\\s*)?${header}[:\\s]*\\n([\\s\\S]*?)(?=(?:#+\\s*)?(?:${nextHeaders.join("|")})[:\\s]*\\n|$)`, "i");
      const m = content.match(pattern);
      return m ? m[1].trim() : "";
    }

    const execSummary = extractSection(aiContent, "EXECUTIVE SUMMARY", ["WHAT'S DONE", "WHAT.S DONE"]);
    const whatsDone = extractSection(aiContent, "WHAT.S DONE", ["WHAT.S IN PROGRESS", "IN PROGRESS"]);
    const whatsInProgress = extractSection(aiContent, "WHAT.S IN PROGRESS|IN PROGRESS", ["RISKS", "BLOCKERS"]);
    const risksSection = extractSection(aiContent, "RISKS.*BLOCKERS|BLOCKERS.*RISKS|RISKS", ["NEXT STEPS"]);
    const nextSteps = extractSection(aiContent, "NEXT STEPS", []);

    function mdToHtml(text: string): string {
      return text
        .split("\n")
        .map((line) => {
          const bullet = line.match(/^[-*]\s+(.*)/);
          if (bullet) return `<li style="margin-bottom:6px">${esc(bullet[1])}</li>`;
          if (line.trim() === "") return "";
          return `<p style="margin:0 0 8px">${esc(line)}</p>`;
        })
        .join("\n")
        .replace(/(<li[^>]*>[\s\S]*?<\/li>(\n<li[^>]*>[\s\S]*?<\/li>)*)/g, (m) =>
          `<ul style="margin:0 0 12px;padding-left:20px">${m}</ul>`
        );
    }

    const branding = await getBranding(project.org_id);
    const agencyName = buildPreparedBy(branding);
    const navy = branding.primary_color ?? "#1B2A4A";
    const accent = branding.secondary_color ?? "#5B9BD5";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(project.name)} — Project Status Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; font-size: 13px; }

  .cover {
    background: ${navy};
    color: white;
    min-height: 280px;
    padding: 48px 56px 40px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .cover-accent { position: absolute; top: 0; left: 0; width: 8px; height: 100%; background: ${accent}; }
  .cover-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .cover-subtitle { font-size: 16px; opacity: 0.75; margin-bottom: 32px; }
  .cover-meta { display: flex; gap: 48px; margin-top: 24px; }
  .cover-meta-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; display: block; margin-bottom: 4px; }
  .cover-meta-item span { font-size: 13px; font-weight: 500; }
  .cover-badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    margin-top: 16px;
    background: ${schedule.color}30;
    color: ${schedule.color === "#dc2626" ? "#ff6b6b" : schedule.color === "#16a34a" ? "#4ade80" : "#fbbf24"};
    border: 1px solid ${schedule.color}60;
  }

  .body { padding: 40px 56px; }
  .section { margin-bottom: 32px; page-break-inside: avoid; }
  .section-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${navy};
    border-bottom: 2px solid ${navy};
    padding-bottom: 6px;
    margin-bottom: 14px;
  }

  .stats-row { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
  .stat-card {
    flex: 1;
    min-width: 100px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px 16px;
    text-align: center;
  }
  .stat-value { font-size: 26px; font-weight: 700; color: ${navy}; }
  .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-top: 2px; }

  .progress-bar-wrap { background: #e2e8f0; border-radius: 9999px; height: 10px; margin: 12px 0; }
  .progress-bar-fill { height: 10px; border-radius: 9999px; background: ${accent}; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: ${navy}; color: white; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #f8fafc; }

  .exec-summary { font-size: 14px; line-height: 1.7; color: #1e293b; }

  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }

  @media print {
    body { font-size: 12px; }
    .cover { min-height: 240px; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- Cover -->
<div class="cover">
  <div class="cover-accent"></div>
  <div>
    <div class="cover-title">${esc(project.name)}</div>
    <div class="cover-subtitle">Project Status Report</div>
    <div class="cover-badge">${esc(schedule.label)} ${schedule.detail ? "— " + esc(schedule.detail) : ""}</div>
  </div>
  <div class="cover-meta">
    <div class="cover-meta-item"><label>Client</label><span>${esc(orgData?.name ?? "—")}</span></div>
    <div class="cover-meta-item"><label>Report Date</label><span>${esc(dateStr)}</span></div>
    <div class="cover-meta-item"><label>Project Start</label><span>${esc(project.start_date ?? "—")}</span></div>
    <div class="cover-meta-item"><label>Target Date</label><span>${esc(project.target_date ?? "TBD")}</span></div>
    <div class="cover-meta-item"><label>Prepared By</label><span>${esc(agencyName)}</span></div>
  </div>
</div>

<!-- Body -->
<div class="body">

  <!-- Stats -->
  <div class="stats-row">
    <div class="stat-card"><div class="stat-value">${progress}%</div><div class="stat-label">Complete</div></div>
    <div class="stat-card"><div class="stat-value">${complete}</div><div class="stat-label">Done</div></div>
    <div class="stat-card"><div class="stat-value">${inProgress}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card"><div class="stat-value">${blocked}</div><div class="stat-label">Blocked</div></div>
    <div class="stat-card"><div class="stat-value">${phaseList.length}</div><div class="stat-label">Phases</div></div>
    <div class="stat-card"><div class="stat-value">${openRisks.length}</div><div class="stat-label">Open Risks</div></div>
  </div>

  <div class="progress-bar-wrap">
    <div class="progress-bar-fill" style="width:${progress}%"></div>
  </div>

  <!-- Executive Summary -->
  <div class="section">
    <div class="section-header">Executive Summary</div>
    <div class="exec-summary">${execSummary ? mdToHtml(execSummary) : mdToHtml(aiContent)}</div>
  </div>

  <!-- What's Done -->
  ${whatsDone ? `<div class="section">
    <div class="section-header">What&rsquo;s Done</div>
    ${mdToHtml(whatsDone)}
  </div>` : ""}

  <!-- In Progress -->
  ${whatsInProgress ? `<div class="section">
    <div class="section-header">In Progress</div>
    ${mdToHtml(whatsInProgress)}
  </div>` : ""}

  <!-- Phase Status Table -->
  <div class="section">
    <div class="section-header">Phase Status</div>
    <table>
      <thead><tr>
        <th>#</th><th>Phase</th><th>Group</th><th>Status</th><th>Due Date</th>
      </tr></thead>
      <tbody>
        ${phaseList.map((p: { phase_order: number; name: string; group?: string | null; status: string; due_date?: string | null }) => `
        <tr>
          <td style="color:#64748b">P${String(p.phase_order).padStart(2, "0")}</td>
          <td style="font-weight:500">${esc(p.name)}</td>
          <td style="color:#64748b">${esc(p.group ?? "—")}</td>
          <td>${statusBadge(p.status, navy)}</td>
          <td style="color:#64748b">${esc(p.due_date ?? "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  <!-- Risks & Blockers -->
  ${risksSection ? `<div class="section">
    <div class="section-header">Risks &amp; Blockers</div>
    ${mdToHtml(risksSection)}
  </div>` : ""}

  <!-- Open Risk Register -->
  ${openRisks.length > 0 ? `<div class="section">
    <div class="section-header">Open Risk Register</div>
    <table>
      <thead><tr><th>Risk</th><th>Probability</th><th>Impact</th><th>Mitigation</th></tr></thead>
      <tbody>
        ${openRisks.map((r: { title: string; probability: string; impact: string; mitigation?: string | null }) => `
        <tr>
          <td style="font-weight:500">${esc(r.title)}</td>
          <td>${esc(r.probability)}</td>
          <td>${esc(r.impact)}</td>
          <td style="color:#475569">${esc(r.mitigation ?? "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  <!-- Next Steps -->
  ${nextSteps ? `<div class="section">
    <div class="section-header">Next Steps</div>
    ${mdToHtml(nextSteps)}
  </div>` : ""}

  <div class="footer">
    <span>${esc(agencyName)} — Confidential</span>
    <span>Generated ${esc(dateStr)}</span>
  </div>

</div>
</body>
</html>`;

    return NextResponse.json({ html });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
