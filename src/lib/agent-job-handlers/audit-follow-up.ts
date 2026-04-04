/**
 * Handler: audit_follow_up
 *
 * Triggered after a site audit completes. Reads the audit scores + findings
 * and auto-generates gap analysis items for the org. Skips if gap items
 * already exist for this audit.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import type { AgentJob } from "@/types/pm";

interface GapItem {
  category: string;
  title: string;
  current_state: string;
  severity: "low" | "medium" | "high" | "critical";
  gap_description: string;
}

export async function runAuditFollowUp(
  job: AgentJob
): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const auditId = job.payload?.audit_id as string | undefined;
  const orgId = job.org_id;

  if (!auditId) return { skipped: true, reason: "No audit_id in payload" };
  if (!orgId) return { skipped: true, reason: "No org_id on job" };

  // 1. Load the audit
  const { data: audit } = await supabase
    .from("pm_site_audits")
    .select("id, url, overall_score, scores, findings, org_id")
    .eq("id", auditId)
    .single();

  if (!audit) return { skipped: true, reason: "Audit not found" };

  // 2. Check if gap items already exist for this audit (don't double-generate)
  const { count } = await supabase
    .from("pm_gap_analysis")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("source_audit_id", auditId);

  if ((count ?? 0) > 0) {
    return { skipped: true, reason: "Gap items already generated for this audit" };
  }

  // 3. Build context for GPT-4o
  const scores = audit.scores as Record<string, number> ?? {};
  const findings = audit.findings as string[] ?? [];

  const scoreLines = Object.entries(scores)
    .map(([cat, score]) => `- ${cat}: ${score}/100`)
    .join("\n");

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You are a digital strategy consultant reviewing a website audit for a client. Convert audit findings into actionable gap analysis items that can be tracked and assigned to a project.`,
      },
      {
        role: "user",
        content: `Website: ${audit.url}
Overall Score: ${audit.overall_score ?? "N/A"}/100

Category Scores:
${scoreLines || "(no category scores)"}

Findings:
${findings.length > 0 ? findings.map((f) => `- ${f}`).join("\n") : "(no findings recorded)"}

Return a JSON array of gap items (up to 8, focus on the most impactful). Each item:
{
  "category": "SEO|Performance|Accessibility|Design|Content|Security|Mobile|Analytics",
  "title": "short gap title (5-8 words)",
  "current_state": "what exists now (1 sentence)",
  "severity": "low|medium|high|critical",
  "gap_description": "specific actionable fix (1-2 sentences)"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  let items: GapItem[] = [];
  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    items = Array.isArray(parsed) ? parsed : (parsed.items ?? parsed.gaps ?? []);
  } catch {
    return { error: "Failed to parse GPT-4o response" };
  }

  if (items.length === 0) {
    return { skipped: true, reason: "No gap items generated", audit_id: auditId };
  }

  // 4. Insert gap analysis items
  const { error: insertError } = await supabase.from("pm_gap_analysis").insert(
    items.map((item) => ({
      org_id: orgId,
      source_audit_id: auditId,
      category: item.category,
      title: item.title,
      current_state: item.current_state,
      severity: item.severity,
      gap_description: item.gap_description,
      status: "identified",
      source: "audit",
    }))
  );

  if (insertError) throw new Error(insertError.message);

  return {
    audit_id: auditId,
    org_id: orgId,
    gaps_added: items.length,
    categories: [...new Set(items.map((i) => i.category))],
    titles: items.map((i) => i.title),
  };
}
