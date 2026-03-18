import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { assembleKBContext } from "@/lib/kb";

// POST /api/pm/templates/generate — AI-generate template phases and tasks from a description
export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const kbContext = await assembleKBContext();

    const openai = getOpenAI();
    const resp = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a project management expert. Generate a project template with phases and tasks based on the user's description.

Return valid JSON in this exact format:
{
  "phases": [
    {
      "order": 1,
      "slug": "phase-slug",
      "name": "Phase Name",
      "group": "GROUP_NAME",
      "tasks": [
        { "slug": "task-slug", "name": "Task Name", "description": "Brief description" }
      ]
    }
  ]
}

Rules:
- Create 4-12 phases that logically cover the project lifecycle
- Each phase should have 2-6 tasks
- Groups help organize phases (e.g. PLANNING, BUILD, LAUNCH, GROW)
- Slugs should be lowercase kebab-case
- Be specific and actionable, not generic
- Order phases chronologically`,
        },
        {
          role: "user",
          content: `Generate a project template for: "${name}"${description ? `\n\nAdditional context: ${description}` : ""}${kbContext}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "No response from AI" }, { status: 500 });

    const parsed = JSON.parse(content);
    return NextResponse.json({ phases: parsed.phases || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate template" },
      { status: 500 }
    );
  }
}
