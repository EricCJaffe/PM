import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateInterviewDocx, generateInterviewMd } from "@/lib/interview-docx";
import type { InterviewResponses } from "@/lib/interview-docx";

const VAULT_BUCKET = "vault";

/**
 * POST /api/pm/discovery-interviews/[id]/export-files
 *
 * Generates .md and .docx from a saved interview record and stores both
 * in Supabase Storage at:
 *   vault/interviews/[org-slug]/[date]-[dept]-[name].{md,docx}
 *
 * Returns signed download URLs for both files.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Load the interview + org
    const { data: interview, error: fetchErr } = await supabase
      .from("pm_discovery_interviews")
      .select("*, pm_organizations(id, slug, name)")
      .eq("id", id)
      .single();

    if (fetchErr || !interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // Parse responses from summary JSON
    let responses: InterviewResponses | null = null;
    if (interview.summary) {
      try {
        const parsed = JSON.parse(interview.summary);
        responses = parsed.responses ?? parsed;
      } catch {
        // summary might not be structured — we'll build from top-level fields
      }
    }

    // Fallback: build minimal responses from top-level fields
    if (!responses) {
      responses = buildFallbackResponses(interview);
    }

    const org = (interview as { pm_organizations?: { slug: string; name: string } }).pm_organizations;
    const orgSlug = org?.slug ?? "unknown-org";
    const orgName = org?.name ?? "Organization";
    const dateStr = interview.interview_date ?? new Date().toISOString().split("T")[0];
    const deptSlug = slugify(interview.interviewee_name ?? "unknown-dept");
    const nameSlug = slugify(interview.interviewee_name ?? "interview");
    const fileBase = `interviews/${orgSlug}/${dateStr}-${deptSlug}-${nameSlug}`;

    // ── Generate .md ──────────────────────────────────────────────────
    const mdContent = generateInterviewMd(responses, orgName);
    const mdPath = `${fileBase}.md`;

    const { error: mdErr } = await supabase.storage
      .from(VAULT_BUCKET)
      .upload(mdPath, Buffer.from(mdContent, "utf-8"), {
        contentType: "text/markdown",
        upsert: true,
      });

    if (mdErr) {
      return NextResponse.json({ error: `MD upload failed: ${mdErr.message}` }, { status: 500 });
    }

    // ── Generate .docx ────────────────────────────────────────────────
    const docxBuffer = await generateInterviewDocx(responses, orgName);
    const docxPath = `${fileBase}.docx`;

    const { error: docxErr } = await supabase.storage
      .from(VAULT_BUCKET)
      .upload(docxPath, docxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (docxErr) {
      return NextResponse.json({ error: `DOCX upload failed: ${docxErr.message}` }, { status: 500 });
    }

    // ── Get signed URLs (1 hour) ──────────────────────────────────────
    const [mdSigned, docxSigned] = await Promise.all([
      supabase.storage.from(VAULT_BUCKET).createSignedUrl(mdPath, 3600),
      supabase.storage.from(VAULT_BUCKET).createSignedUrl(docxPath, 3600),
    ]);

    return NextResponse.json({
      md: {
        path: mdPath,
        url: mdSigned.data?.signedUrl ?? null,
        filename: `${dateStr}-${deptSlug}-interview.md`,
      },
      docx: {
        path: docxPath,
        url: docxSigned.data?.signedUrl ?? null,
        filename: `${dateStr}-${deptSlug}-interview.docx`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Build minimal InterviewResponses from the DB row when summary JSON is absent
function buildFallbackResponses(interview: Record<string, unknown>): InterviewResponses {
  const empty = { flow: "", manual_steps: "", collection_tracking: "", delays_errors: "" };
  return {
    interviewee_name: String(interview.interviewee_name ?? ""),
    department: String(interview.title ?? "").replace(" Department — Discovery Interview", ""),
    interviewee_role: String(interview.interviewee_role ?? ""),
    interviewer: "",
    interview_date: String(interview.interview_date ?? ""),
    quote_to_cash: empty,
    people: { team_size: "", key_roles: "", skill_gaps: "", coverage_when_out: "" },
    data: { what_is_tracked: "", where_it_lives: "", how_decisions_made: "", wish_had: "" },
    processes: { core_workflows: "", manual_that_should_be_automated: "", falls_through_cracks: "", how_new_people_learn: "" },
    communication: { meeting_cadence: "", reporting_to_leadership: "", tools_used: "", cross_dept_handoffs: "" },
    issues: { biggest_frustration: "", slows_team_down: "", breaks_regularly: "", leadership_misunderstands: "" },
    dreams: { magic_wand: "", ideal_day: "", done_right: "" },
    must_haves: { must_have_1: "", must_have_2: "" },
    tools: { daily_tools: "", love_about_current: "", hate_about_current: "", wish_had: "" },
  };
}
