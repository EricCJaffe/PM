/**
 * Handler: engagement_risk_scan
 *
 * Runs nightly per org. Reads open engagements + their tasks, then uses
 * GPT-4o to identify risks and writes them to pm_risks on the associated
 * project. Skips orgs with no active engagements.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import type { AgentJob } from "@/types/pm";

interface RiskItem {
  title: string;
  description: string;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation: string;
}

export async function runEngagementRiskScan(
  job: AgentJob
): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const orgId = job.org_id;

  if (!orgId) return { skipped: true, reason: "No org_id on job" };

  // 1. Get org name
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, name")
    .eq("id", orgId)
    .single();

  if (!org) return { skipped: true, reason: "Org not found" };

  // 2. Get active engagements with their projects
  const { data: engagements } = await supabase
    .from("pm_engagements")
    .select("id, name, deal_stage, service_type, value, project_id")
    .eq("org_id", orgId)
    .not("deal_stage", "in", '("closed_lost","closed_won")');

  if (!engagements || engagements.length === 0) {
    return { skipped: true, reason: "No active engagements" };
  }

  // 3. For each engagement with a project, get tasks + existing risks
  const projectIds = engagements
    .map((e) => e.project_id)
    .filter(Boolean) as string[];

  if (projectIds.length === 0) {
    return { skipped: true, reason: "No engagements linked to projects" };
  }

  const { data: tasks } = await supabase
    .from("pm_tasks")
    .select("title, status, owner, due_date, priority")
    .in("project_id", projectIds);

  const { data: existingRisks } = await supabase
    .from("pm_risks")
    .select("title")
    .in("project_id", projectIds);

  const existingTitles = new Set((existingRisks ?? []).map((r) => r.title.toLowerCase()));

  // 4. Build context and ask GPT-4o for risks
  const taskSummary = (tasks ?? [])
    .map((t) => `- ${t.title} [${t.status}${t.due_date ? `, due ${t.due_date}` : ""}${t.priority ? `, priority: ${t.priority}` : ""}]`)
    .join("\n");

  const engagementSummary = engagements
    .map((e) => `- ${e.name || "Unnamed"} (${e.deal_stage}, ${e.service_type ?? "unknown type"})`)
    .join("\n");

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You are a risk analyst for a consulting firm. Identify project and engagement risks based on the current status of tasks and engagement details. Be concise, specific, and actionable. Only flag genuine risks — not obvious low-impact items.`,
      },
      {
        role: "user",
        content: `Org: ${org.name}

Active Engagements:
${engagementSummary}

Current Tasks:
${taskSummary || "(no tasks yet)"}

Return a JSON array of up to 5 risks. Each risk:
{
  "title": "short risk title",
  "description": "1-2 sentence description of the risk",
  "probability": "low|medium|high",
  "impact": "low|medium|high",
  "mitigation": "1-2 sentence recommended action"
}

Only include risks not already covered by these existing risk titles: ${[...existingTitles].join(", ") || "none yet"}.
If no new risks exist, return an empty array [].`,
      },
    ],
    response_format: { type: "json_object" },
  });

  let risks: RiskItem[] = [];
  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    risks = Array.isArray(parsed) ? parsed : (parsed.risks ?? []);
  } catch {
    return { error: "Failed to parse GPT-4o response", raw: completion.choices[0].message.content };
  }

  if (risks.length === 0) {
    return { org: org.name, risks_added: 0, message: "No new risks identified" };
  }

  // 5. Write risks to the first linked project (most recently active)
  const targetProjectId = projectIds[0];

  const { error: insertError } = await supabase.from("pm_risks").insert(
    risks.map((r) => ({
      project_id: targetProjectId,
      slug: `agent-${Date.now()}-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      title: r.title,
      description: r.description,
      probability: r.probability,
      impact: r.impact,
      mitigation: r.mitigation,
      status: "open",
    }))
  );

  if (insertError) throw new Error(insertError.message);

  return {
    org: org.name,
    risks_added: risks.length,
    risk_titles: risks.map((r) => r.title),
  };
}
