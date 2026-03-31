import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

const THRESHOLDS = {
  seo: 70,
  conversion: 70,
  ai_discoverability: 60,
  content: 60,
};

interface ScoreDimension {
  score: number;
  grade: string;
  pass: boolean;
  notes: string[];
}

interface ScoringResults {
  scored_at: string;
  overall_score: number;
  overall_pass: boolean;
  dimensions: Record<string, ScoreDimension>;
  blocking_issues: string[];
  recommendations: string[];
}

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

// POST /api/pm/web-passes/[id]/score — run scoring rubric against deliverable HTML
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: pass, error: passError } = await supabase
    .from("pm_web_passes")
    .select("*")
    .eq("id", id)
    .single();

  if (passError || !pass) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 });
  }

  if (!pass.deliverable_html) {
    return NextResponse.json({ error: "No deliverable HTML to score" }, { status: 400 });
  }

  const openai = getOpenAI();

  // Truncate HTML to stay within token limits
  const htmlSnippet = pass.deliverable_html.slice(0, 12000);

  const prompt = `You are a website quality scoring AI. Analyze the following HTML and score it across 4 dimensions on a 0–100 scale. Return ONLY valid JSON with no explanation.

HTML:
${htmlSnippet}

Return this exact JSON structure:
{
  "seo": {
    "score": <0-100>,
    "notes": ["<finding>", ...]
  },
  "conversion": {
    "score": <0-100>,
    "notes": ["<finding>", ...]
  },
  "ai_discoverability": {
    "score": <0-100>,
    "notes": ["<finding>", ...]
  },
  "content": {
    "score": <0-100>,
    "notes": ["<finding>", ...]
  },
  "blocking_issues": ["<critical issue if any>"],
  "recommendations": ["<quick fix>", ...]
}

Scoring criteria:
- SEO (${THRESHOLDS.seo} minimum): title tag, meta description, heading hierarchy, alt text, semantic HTML, schema.org markup
- Conversion (${THRESHOLDS.conversion} minimum): clear CTA, value proposition above fold, contact info visible, trust signals
- AI Discoverability (${THRESHOLDS.ai_discoverability} minimum): structured data, clear entity names, descriptive copy, llms.txt hints
- Content (${THRESHOLDS.content} minimum): placeholder text removed, complete copy, no lorem ipsum, images referenced properly`;

  let aiResult: Record<string, unknown>;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    aiResult = JSON.parse(response.choices[0].message.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "AI scoring failed" }, { status: 500 });
  }

  // Build structured results
  const dimensions: Record<string, ScoreDimension> = {};
  let totalScore = 0;
  let dimensionCount = 0;

  for (const dim of ["seo", "conversion", "ai_discoverability", "content"] as const) {
    const raw = aiResult[dim] as { score: number; notes: string[] } | undefined;
    const score = Math.min(100, Math.max(0, raw?.score ?? 0));
    const threshold = THRESHOLDS[dim];
    dimensions[dim] = {
      score,
      grade: gradeFromScore(score),
      pass: score >= threshold,
      notes: raw?.notes ?? [],
    };
    totalScore += score;
    dimensionCount++;
  }

  const overallScore = Math.round(totalScore / dimensionCount);
  const overallPass = Object.entries(dimensions).every(([dim, d]) => {
    const threshold = THRESHOLDS[dim as keyof typeof THRESHOLDS];
    return threshold === undefined || d.score >= threshold;
  });

  const results: ScoringResults = {
    scored_at: new Date().toISOString(),
    overall_score: overallScore,
    overall_pass: overallPass,
    dimensions,
    blocking_issues: (aiResult.blocking_issues as string[]) ?? [],
    recommendations: (aiResult.recommendations as string[]) ?? [],
  };

  // Save to pass
  await supabase
    .from("pm_web_passes")
    .update({ scoring_results: results })
    .eq("id", id);

  return NextResponse.json(results);
}
