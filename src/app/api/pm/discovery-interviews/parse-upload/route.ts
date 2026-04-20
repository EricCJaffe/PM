import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import JSZip from "jszip";

const VAULT_BUCKET = "vault";

/**
 * POST /api/pm/discovery-interviews/parse-upload
 *
 * Accepts a .txt, .md, or .docx file containing interview notes.
 * Extracts text, runs GPT-4o to map content to interview sections,
 * stores the original file in vault, and creates a pm_discovery_interviews record.
 *
 * FormData fields:
 *   file        — the uploaded file
 *   org_id      — required
 *   department  — required
 *   interviewer — optional
 *   interviewee_name — optional
 *   interviewee_role — optional
 *   interview_date   — optional (defaults to today)
 *   department_id    — optional UUID
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const orgId = formData.get("org_id") as string | null;
    const department = (formData.get("department") as string | null) ?? "";
    const interviewer = (formData.get("interviewer") as string | null) ?? "";
    const intervieweeName = (formData.get("interviewee_name") as string | null) ?? "";
    const intervieweeRole = (formData.get("interviewee_role") as string | null) ?? "";
    const interviewDate = (formData.get("interview_date") as string | null) ?? new Date().toISOString().split("T")[0];
    const departmentId = (formData.get("department_id") as string | null) ?? null;

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (!orgId) return NextResponse.json({ error: "org_id is required" }, { status: 400 });

    // ── 1. Extract text from file ────────────────────────────────────
    const rawText = await extractText(file);

    if (!rawText.trim()) {
      return NextResponse.json({ error: "Could not extract text from file" }, { status: 422 });
    }

    // ── 2. Store original file in vault ──────────────────────────────
    const supabase = createServiceClient();
    const { data: orgRow } = await supabase
      .from("pm_organizations")
      .select("slug, name")
      .eq("id", orgId)
      .single();

    const orgSlug = orgRow?.slug ?? "unknown";
    const orgName = orgRow?.name ?? "Organization";
    const deptSlug = slugify(department || "department");
    const nameSlug = slugify(intervieweeName || "interview");
    const storagePath = `interviews/${orgSlug}/${interviewDate}-${deptSlug}-${nameSlug}-upload${ext(file.name)}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await supabase.storage
      .from(VAULT_BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    // ── 3. AI parse raw text → structured sections ───────────────────
    const parsed = await parseWithGPT(rawText, {
      department,
      intervieweeName,
      intervieweeRole,
      orgName,
    });

    // ── 4. Build key_findings from issues section ─────────────────────
    const key_findings = Object.values(parsed.issues ?? {})
      .filter(Boolean)
      .map((finding) => ({ finding, category: "issues", severity: "medium" as const }));

    // ── 5. Build action_items from must_haves ─────────────────────────
    const action_items = [parsed.must_haves?.must_have_1, parsed.must_haves?.must_have_2]
      .filter(Boolean)
      .map((item) => ({ item, assigned_to: null, due_date: null }));

    // ── 6. Create the interview record ────────────────────────────────
    const title = `${department || "Department"} Department — Discovery Interview`;
    const summary = JSON.stringify({
      responses: {
        interviewee_name: intervieweeName,
        department,
        interviewee_role: intervieweeRole,
        interviewer,
        interview_date: interviewDate,
        org_id: orgId,
        ...parsed,
      },
      captured_by: interviewer,
      source: "upload",
      original_filename: file.name,
    });

    const { data: record, error: insertErr } = await supabase
      .from("pm_discovery_interviews")
      .insert({
        org_id: orgId,
        department_id: departmentId,
        title,
        interviewee_name: intervieweeName || null,
        interviewee_role: intervieweeRole || null,
        interview_date: interviewDate,
        focus_areas: ["quote-to-cash", "people", "data", "processes", "communication", "issues", "tools"],
        key_findings,
        action_items,
        summary,
        status: "completed",
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      interview: record,
      parsed_sections: parsed,
      original_file_path: storagePath,
      org_name: orgName,
    }, { status: 201 });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return await file.text();
  }

  if (name.endsWith(".docx")) {
    return await extractDocxText(file);
  }

  // fallback: try treating as text
  return await file.text();
}

async function extractDocxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) return "";

  // Strip XML tags, decode entities, collapse whitespace
  return docXml
    .replace(/<w:p[ >]/g, "\n<w:p>")       // paragraph breaks
    .replace(/<w:br[^/]*/g, "\n")            // line breaks
    .replace(/<[^>]+>/g, "")                 // strip all tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x[0-9A-Fa-f]+;/g, " ")
    .replace(/[ \t]{2,}/g, " ")             // collapse spaces
    .replace(/\n{3,}/g, "\n\n")             // collapse blank lines
    .trim();
}

// ─── GPT-4o mapping ───────────────────────────────────────────────────────────

interface ParsedSections {
  quote_to_cash: { flow: string; manual_steps: string; collection_tracking: string; delays_errors: string };
  people: { team_size: string; key_roles: string; skill_gaps: string; coverage_when_out: string };
  data: { what_is_tracked: string; where_it_lives: string; how_decisions_made: string; wish_had: string };
  processes: { core_workflows: string; manual_that_should_be_automated: string; falls_through_cracks: string; how_new_people_learn: string };
  communication: { meeting_cadence: string; reporting_to_leadership: string; tools_used: string; cross_dept_handoffs: string };
  issues: { biggest_frustration: string; slows_team_down: string; breaks_regularly: string; leadership_misunderstands: string };
  dreams: { magic_wand: string; ideal_day: string; done_right: string };
  must_haves: { must_have_1: string; must_have_2: string };
  tools: { daily_tools: string; love_about_current: string; hate_about_current: string; wish_had: string };
}

async function parseWithGPT(rawText: string, context: {
  department: string;
  intervieweeName: string;
  intervieweeRole: string;
  orgName: string;
}): Promise<ParsedSections> {
  const openai = getOpenAI();

  const systemPrompt = `You are a business analyst assistant helping structure department head interview notes.
Given raw interview notes, extract and organize the content into the following 9 sections.
Return ONLY valid JSON matching the exact structure below. If information for a field is not present, use an empty string "".
Do not add commentary outside the JSON.`;

  const userPrompt = `Interview context:
- Department: ${context.department || "Unknown"}
- Interviewee: ${context.intervieweeName || "Unknown"}
- Role: ${context.intervieweeRole || "Unknown"}
- Organization: ${context.orgName}

Raw interview notes:
---
${rawText.slice(0, 12000)}
---

Return this exact JSON structure, filling each field with relevant content extracted from the notes:
{
  "quote_to_cash": {
    "flow": "How does a lead become revenue? What is the end-to-end flow?",
    "manual_steps": "What billing/invoicing/fulfillment steps are manual?",
    "collection_tracking": "How are collections tracked?",
    "delays_errors": "Where are the biggest delays or errors?"
  },
  "people": {
    "team_size": "Team size and key roles",
    "key_roles": "Ideal team structure in 12-18 months",
    "skill_gaps": "Skill gaps or capacity constraints",
    "coverage_when_out": "Coverage when someone is out"
  },
  "data": {
    "what_is_tracked": "Data the department tracks",
    "where_it_lives": "Where data lives (systems, spreadsheets, etc.)",
    "how_decisions_made": "How data is used for decisions",
    "wish_had": "Data they wish they had"
  },
  "processes": {
    "core_workflows": "Core workflows described",
    "manual_that_should_be_automated": "Manual work that should be automated",
    "falls_through_cracks": "Where things fall through the cracks",
    "how_new_people_learn": "How new employees learn processes"
  },
  "communication": {
    "meeting_cadence": "Meeting frequency and format",
    "reporting_to_leadership": "How they report to leadership",
    "tools_used": "Communication tools",
    "cross_dept_handoffs": "Cross-department handoff process"
  },
  "issues": {
    "biggest_frustration": "Primary frustration",
    "slows_team_down": "What slows the team",
    "breaks_regularly": "What fails or breaks regularly",
    "leadership_misunderstands": "What leadership misunderstands"
  },
  "dreams": {
    "magic_wand": "What they would change with a magic wand",
    "ideal_day": "What ideal day looks like with better systems",
    "done_right": "What done right looks like in 2 years"
  },
  "must_haves": {
    "must_have_1": "Top must-have requirement",
    "must_have_2": "Second must-have requirement"
  },
  "tools": {
    "daily_tools": "Tools used every day",
    "love_about_current": "What they love about current tools",
    "hate_about_current": "What they dislike about current tools",
    "wish_had": "Tools they wish they had"
  }
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as ParsedSections;
  } catch {
    return emptyParsed();
  }
}

function emptyParsed(): ParsedSections {
  return {
    quote_to_cash: { flow: "", manual_steps: "", collection_tracking: "", delays_errors: "" },
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

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function ext(filename: string): string {
  const m = filename.match(/\.[^.]+$/);
  return m ? m[0] : "";
}
