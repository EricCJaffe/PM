import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { assembleKBContext } from "@/lib/kb";
import { assembleDiscoveryFindings } from "@/lib/discovery-assembler";

/**
 * GET /api/pm/discovery-findings?org_id=...
 * List past discovery summaries for an org (stored as client notes with note_type "general" and author "AI Discovery")
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("org_id");
    if (!orgId) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: summaries, error } = await supabase
      .from("pm_client_notes")
      .select("id, title, body, created_at")
      .eq("org_id", orgId)
      .eq("author", "AI Discovery")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ summaries: summaries ?? [] });
  } catch (err) {
    console.error("Discovery findings list error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pm/discovery-findings
 * Generate an AI discovery findings summary from all discovery data
 * Body: { org_id: string, engagement_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { org_id, engagement_id } = await request.json();

    if (!org_id) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    // Assemble all discovery data
    const data = await assembleDiscoveryFindings(org_id, engagement_id);

    // Check we have something to summarize
    const hasData =
      data.interviews.length > 0 ||
      data.gaps.length > 0 ||
      data.notes.length > 0 ||
      data.site_audits.length > 0 ||
      data.engagement?.discovery_notes;

    if (!hasData) {
      return NextResponse.json(
        { error: "No discovery data found. Add interviews, notes, gap analysis items, or site audits first." },
        { status: 404 }
      );
    }

    // Build context sections
    const sections: string[] = [];

    // Engagement context
    if (data.engagement) {
      const e = data.engagement;
      sections.push(
        `## Engagement Overview\n` +
        `- Title: ${e.title}\n` +
        `- Type: ${e.type ?? "N/A"}\n` +
        `- Service Line: ${e.service_line ?? "N/A"}\n` +
        `- Deal Stage: ${e.deal_stage}\n` +
        `- Estimated Value: ${e.estimated_value ? `$${e.estimated_value.toLocaleString()}` : "N/A"}\n` +
        (e.discovery_notes ? `\n### Discovery Notes\n${e.discovery_notes}` : "")
      );
    }

    // Interviews
    if (data.interviews.length > 0) {
      const interviewText = data.interviews
        .map((i) => {
          let text = `### ${i.title} (${i.status})`;
          if (i.interviewee) text += `\nInterviewee: ${i.interviewee}${i.role ? ` — ${i.role}` : ""}`;
          text += `\nDate: ${new Date(i.date).toLocaleDateString()}`;
          if (i.focus_areas.length > 0) text += `\nFocus Areas: ${i.focus_areas.join(", ")}`;
          if (i.key_findings.length > 0) {
            text += `\nKey Findings:\n${i.key_findings.map((f) => `  - [${f.severity}/${f.category}] ${f.finding}`).join("\n")}`;
          }
          if (i.action_items.length > 0) {
            text += `\nAction Items:\n${i.action_items.map((a) => `  - ${a.item}${a.assigned_to ? ` (assigned: ${a.assigned_to})` : ""}${a.due_date ? ` (due: ${a.due_date})` : ""}`).join("\n")}`;
          }
          if (i.summary) text += `\nSummary: ${i.summary}`;
          return text;
        })
        .join("\n\n");
      sections.push(`## Discovery Interviews (${data.interviews.length})\n\n${interviewText}`);
    }

    // Gap Analysis
    if (data.gaps.length > 0) {
      const gapText = data.gaps
        .map((g) => {
          let text = `- **${g.title}** [${g.severity}/${g.status}] — ${g.category}`;
          if (g.department_name) text += ` (${g.department_name})`;
          if (g.gap_description) text += `\n  ${g.gap_description}`;
          if (g.current_state) text += `\n  Current: ${g.current_state}`;
          if (g.desired_state) text += `\n  Desired: ${g.desired_state}`;
          return text;
        })
        .join("\n");
      sections.push(
        `## Gap Analysis (${data.gaps.length} items — ${data.stats.critical_gaps} critical, ${data.stats.high_gaps} high)\n\n${gapText}`
      );
    }

    // Client Notes
    if (data.notes.length > 0) {
      const noteText = data.notes
        .slice(0, 20)
        .map(
          (n) =>
            `[${n.note_type.toUpperCase()}] ${n.title} (${new Date(n.date).toLocaleDateString()})${n.author ? ` — ${n.author}` : ""}\n${n.body || "(no content)"}`
        )
        .join("\n\n---\n\n");
      sections.push(`## Client Notes (${data.notes.length})\n\n${noteText}`);
    }

    // Site Audits
    if (data.site_audits.length > 0) {
      const auditText = data.site_audits
        .map((a) => {
          let text = `- **${a.url}** — Score: ${a.overall_score ?? "N/A"}/100 (${a.overall_grade ?? "N/A"})`;
          if (a.rebuild_recommended) text += " ⚠️ REBUILD RECOMMENDED";
          text += ` (${new Date(a.created_at).toLocaleDateString()})`;
          const dims = Object.entries(a.dimensions);
          if (dims.length > 0) {
            text += `\n  Dimensions: ${dims.map(([k, v]) => `${k}: ${v.score}/100`).join(", ")}`;
          }
          return text;
        })
        .join("\n");
      sections.push(`## Site Audits\n\n${auditText}`);
    }

    const discoveryContext = sections.join("\n\n---\n\n");
    const kbContext = await assembleKBContext(org_id);

    // Generate AI summary
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a senior business analyst generating a comprehensive Discovery Findings Brief for a client engagement. This brief will be used by the team to inform proposal creation, project scoping, and strategic recommendations.

Generate a structured discovery summary in markdown format with these sections:

1. **Executive Summary** — 3-5 sentence high-level overview of the client's situation, key challenges, and opportunity
2. **Client Profile & Context** — who they are, what they do, where they are in their journey
3. **Key Findings** — the most important discoveries organized by theme (not just a list — synthesize across interviews, notes, and gaps)
4. **Gap Analysis Summary** — organized by severity, with counts and the most critical items highlighted
5. **Digital Presence Assessment** — if site audit data is available, summarize the current state and recommendations
6. **Risk Factors** — potential challenges or concerns that could affect the engagement
7. **Opportunities** — specific areas where the team can add the most value
8. **Recommended Next Steps** — prioritized action items with clear ownership suggestions
9. **Proposal Recommendations** — what the proposal should emphasize, estimated scope/complexity, and suggested service approach

Be specific, actionable, and data-driven. Reference specific findings from interviews and gap analysis. Avoid generic consulting language — be direct about what matters.`,
        },
        {
          role: "user",
          content: `Generate a Discovery Findings Brief for ${data.org_name}.\n\nStatistics:\n- ${data.stats.total_interviews} interviews (${data.stats.completed_interviews} completed)\n- ${data.stats.total_gaps} gaps identified (${data.stats.critical_gaps} critical, ${data.stats.high_gaps} high, ${data.stats.resolved_gaps} resolved)\n- ${data.stats.total_notes} client notes\n- ${data.stats.total_action_items} action items from interviews\n- ${data.site_audits.length} site audits completed\n\n${discoveryContext}${kbContext}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content ?? "Summary generation failed.";

    // Save as a client note for historical reference
    const supabase = createServiceClient();
    const { data: savedNote, error: saveErr } = await supabase
      .from("pm_client_notes")
      .insert({
        org_id,
        title: `Discovery Findings Brief — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        body: summary,
        note_type: "general",
        visibility: "internal",
        author: "AI Discovery",
        pinned: true,
      })
      .select()
      .single();

    if (saveErr) {
      console.warn("Failed to save discovery brief:", saveErr.message);
    }

    return NextResponse.json({
      summary,
      stats: data.stats,
      saved_note_id: savedNote?.id ?? null,
    });
  } catch (err) {
    console.error("Discovery findings generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
