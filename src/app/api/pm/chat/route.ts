import { NextRequest, NextResponse } from "next/server";
import type OpenAI from "openai";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { assembleKBContext } from "@/lib/kb";

const SYSTEM_PROMPT = `You are an AI project management assistant for BusinessOS with full read/write access to the project database.

You CAN and SHOULD directly make changes when asked. Do not tell the user to do things manually — use your tools to do it yourself.

Available actions (use these tools):
- add_task: Create a new task in a phase
- update_task: Change status, owner, due date, or name of an existing task
- delete_task: Delete a task by name
- add_phase: Add a new phase to the project
- update_phase: Change status, progress, or owner of a phase
- delete_phase: Delete a phase (and all its tasks) by name
- add_risk: Add a risk to the risk register
- update_risk: Update an existing risk's fields
- delete_risk: Delete a risk by title
- update_project: Change project status, owner, or target date

After using a tool, summarize what you did in plain language. If something fails, explain why.`;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_task",
      description: "Add a new task to a phase in the project",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Task name" },
          phase_slug: { type: "string", description: "Slug of the phase to add the task to (use phase list from context)" },
          status: { type: "string", enum: ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"], description: "Task status" },
          owner: { type: "string", description: "Owner name or slug (optional)" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format (optional)" },
          description: { type: "string", description: "Task description (optional)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update an existing task's status, owner, due date, or name",
      parameters: {
        type: "object",
        properties: {
          task_name: { type: "string", description: "Current name of the task (used to find it)" },
          status: { type: "string", enum: ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] },
          owner: { type: "string", description: "New owner" },
          due_date: { type: "string", description: "New due date YYYY-MM-DD" },
          new_name: { type: "string", description: "Rename the task to this" },
        },
        required: ["task_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_phase",
      description: "Add a new phase to the project",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Phase name" },
          group: { type: "string", description: "Phase group label (optional, e.g. BUILD, GROW)" },
          status: { type: "string", enum: ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_phase",
      description: "Update a phase's status, progress, or owner",
      parameters: {
        type: "object",
        properties: {
          phase_name: { type: "string", description: "Current name of the phase" },
          status: { type: "string", enum: ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] },
          progress: { type: "number", description: "Progress percentage 0-100" },
          owner: { type: "string", description: "New owner" },
        },
        required: ["phase_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_risk",
      description: "Add a risk to the project risk register",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Risk title" },
          description: { type: "string", description: "Risk description" },
          probability: { type: "string", enum: ["low", "medium", "high"] },
          impact: { type: "string", enum: ["low", "medium", "high"] },
          mitigation: { type: "string", description: "Mitigation strategy" },
          owner: { type: "string", description: "Risk owner" },
        },
        required: ["title", "probability", "impact"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task from the project",
      parameters: {
        type: "object",
        properties: {
          task_name: { type: "string", description: "Name of the task to delete" },
        },
        required: ["task_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_phase",
      description: "Delete a phase and all its tasks",
      parameters: {
        type: "object",
        properties: {
          phase_name: { type: "string", description: "Name of the phase to delete" },
        },
        required: ["phase_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_risk",
      description: "Update an existing risk in the risk register",
      parameters: {
        type: "object",
        properties: {
          risk_title: { type: "string", description: "Current title of the risk (used to find it)" },
          title: { type: "string", description: "New title (optional)" },
          description: { type: "string" },
          probability: { type: "string", enum: ["low", "medium", "high"] },
          impact: { type: "string", enum: ["low", "medium", "high"] },
          mitigation: { type: "string" },
          owner: { type: "string" },
          status: { type: "string", enum: ["open", "mitigated", "closed"] },
        },
        required: ["risk_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_risk",
      description: "Delete a risk from the risk register",
      parameters: {
        type: "object",
        properties: {
          risk_title: { type: "string", description: "Title of the risk to delete" },
        },
        required: ["risk_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project",
      description: "Update the project's status, owner, or target date",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "complete", "paused", "archived", "on-hold"] },
          owner: { type: "string" },
          target_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: [],
      },
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  projectId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  try {
    if (name === "add_task") {
      const { data: project, error: projectError } = await supabase
        .from("pm_projects")
        .select("org_id")
        .eq("id", projectId)
        .single();
      if (projectError || !project?.org_id) {
        return "Failed to add task: project org_id could not be resolved.";
      }

      let phaseId: string | null = null;
      if (args.phase_slug) {
        const { data: phase } = await supabase
          .from("pm_phases")
          .select("id")
          .eq("project_id", projectId)
          .eq("slug", args.phase_slug as string)
          .single();
        phaseId = phase?.id ?? null;
      }
      const slug = slugify(args.name as string);
      const { error } = await supabase.from("pm_tasks").insert({
        project_id: projectId,
        org_id: project.org_id,
        phase_id: phaseId,
        slug,
        name: args.name,
        status: (args.status as string) ?? "not-started",
        owner: (args.owner as string) ?? null,
        due_date: (args.due_date as string) ?? null,
        description: (args.description as string) ?? null,
      });
      if (error) return `Failed to add task: ${error.message}`;
      return `Task "${args.name}" added successfully${phaseId ? ` to phase ${args.phase_slug}` : ""}.`;
    }

    if (name === "update_task") {
      const { data: task } = await supabase
        .from("pm_tasks")
        .select("id")
        .eq("project_id", projectId)
        .ilike("name", `%${args.task_name as string}%`)
        .limit(1)
        .single();
      if (!task) return `Task matching "${args.task_name}" not found.`;
      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.owner) updates.owner = args.owner;
      if (args.due_date) updates.due_date = args.due_date;
      if (args.new_name) { updates.name = args.new_name; updates.slug = slugify(args.new_name as string); }
      const { error } = await supabase.from("pm_tasks").update(updates).eq("id", task.id);
      if (error) return `Failed to update task: ${error.message}`;
      return `Task "${args.task_name}" updated successfully.`;
    }

    if (name === "add_phase") {
      const { data: maxPhase } = await supabase
        .from("pm_phases")
        .select("phase_order")
        .eq("project_id", projectId)
        .order("phase_order", { ascending: false })
        .limit(1)
        .single();
      const nextOrder = ((maxPhase?.phase_order as number) ?? 0) + 1;
      const slug = slugify(args.name as string);
      const { error } = await supabase.from("pm_phases").insert({
        project_id: projectId,
        slug,
        name: args.name,
        phase_order: nextOrder,
        group: (args.group as string) ?? null,
        status: (args.status as string) ?? "not-started",
        progress: 0,
      });
      if (error) return `Failed to add phase: ${error.message}`;
      return `Phase "${args.name}" added as P${String(nextOrder).padStart(2, "0")}.`;
    }

    if (name === "update_phase") {
      const { data: phase } = await supabase
        .from("pm_phases")
        .select("id")
        .eq("project_id", projectId)
        .ilike("name", `%${args.phase_name as string}%`)
        .limit(1)
        .single();
      if (!phase) return `Phase matching "${args.phase_name}" not found.`;
      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.progress !== undefined) updates.progress = args.progress;
      if (args.owner) updates.owner = args.owner;
      const { error } = await supabase.from("pm_phases").update(updates).eq("id", phase.id);
      if (error) return `Failed to update phase: ${error.message}`;
      return `Phase "${args.phase_name}" updated successfully.`;
    }

    if (name === "add_risk") {
      const slug = slugify(args.title as string);
      const { error } = await supabase.from("pm_risks").insert({
        project_id: projectId,
        slug,
        title: args.title,
        description: (args.description as string) ?? null,
        probability: args.probability ?? "medium",
        impact: args.impact ?? "medium",
        mitigation: (args.mitigation as string) ?? null,
        owner: (args.owner as string) ?? null,
        status: "open",
      });
      if (error) return `Failed to add risk: ${error.message}`;
      return `Risk "${args.title}" added to the risk register.`;
    }

    if (name === "delete_task") {
      const { data: task } = await supabase
        .from("pm_tasks").select("id").eq("project_id", projectId)
        .ilike("name", `%${args.task_name as string}%`).limit(1).single();
      if (!task) return `Task matching "${args.task_name}" not found.`;
      const { error } = await supabase.from("pm_tasks").delete().eq("id", task.id);
      if (error) return `Failed to delete task: ${error.message}`;
      return `Task "${args.task_name}" deleted.`;
    }

    if (name === "delete_phase") {
      const { data: phase } = await supabase
        .from("pm_phases").select("id").eq("project_id", projectId)
        .ilike("name", `%${args.phase_name as string}%`).limit(1).single();
      if (!phase) return `Phase matching "${args.phase_name}" not found.`;
      const { error } = await supabase.from("pm_phases").delete().eq("id", phase.id);
      if (error) return `Failed to delete phase: ${error.message}`;
      return `Phase "${args.phase_name}" and all its tasks deleted.`;
    }

    if (name === "update_risk") {
      const { data: risk } = await supabase
        .from("pm_risks").select("id").eq("project_id", projectId)
        .ilike("title", `%${args.risk_title as string}%`).limit(1).single();
      if (!risk) return `Risk matching "${args.risk_title}" not found.`;
      const updates: Record<string, unknown> = {};
      for (const key of ["title", "description", "probability", "impact", "mitigation", "owner", "status"]) {
        if (args[key]) updates[key] = args[key];
      }
      const { error } = await supabase.from("pm_risks").update(updates).eq("id", risk.id);
      if (error) return `Failed to update risk: ${error.message}`;
      return `Risk "${args.risk_title}" updated.`;
    }

    if (name === "delete_risk") {
      const { data: risk } = await supabase
        .from("pm_risks").select("id").eq("project_id", projectId)
        .ilike("title", `%${args.risk_title as string}%`).limit(1).single();
      if (!risk) return `Risk matching "${args.risk_title}" not found.`;
      const { error } = await supabase.from("pm_risks").delete().eq("id", risk.id);
      if (error) return `Failed to delete risk: ${error.message}`;
      return `Risk "${args.risk_title}" deleted.`;
    }

    if (name === "update_project") {
      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.owner) updates.owner = args.owner;
      if (args.target_date) updates.target_date = args.target_date;
      const { error } = await supabase.from("pm_projects").update(updates).eq("id", projectId);
      if (error) return `Failed to update project: ${error.message}`;
      return `Project updated successfully.`;
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { project_id, project_slug, message, history = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const [
      { data: project },
      { data: phases },
      { data: tasks },
      { data: risks },
    ] = await Promise.all([
      supabase.from("pm_projects").select("*").eq("id", project_id).single(),
      supabase.from("pm_phases").select("*").eq("project_id", project_id).order("phase_order"),
      supabase.from("pm_tasks").select("*").eq("project_id", project_id),
      supabase.from("pm_risks").select("*").eq("project_id", project_id),
    ]);

    // Assemble KB context for AI
    const kbContext = await assembleKBContext(project?.org_id, project_id);

    const context = `
Project: ${project?.name ?? project_slug} (${project?.status ?? "unknown"})
Owner: ${project?.owner ?? "unassigned"}
Template: ${project?.template_slug ?? "unknown"}
Start: ${project?.start_date ?? "—"} | Target: ${project?.target_date ?? "—"}

Phases (${phases?.length ?? 0}):
${phases?.map((p: { phase_order: number; slug: string; name: string; status: string; progress: number }) => `  P${String(p.phase_order).padStart(2, "0")} slug:${p.slug} "${p.name}" — ${p.status} (${p.progress}%)`).join("\n") ?? "None"}

Tasks (${tasks?.length ?? 0}):
${tasks?.slice(0, 50).map((t: { name: string; status: string; owner: string; due_date: string }) => `  - "${t.name}" [${t.status}] owner:${t.owner ?? "—"} due:${t.due_date ?? "—"}`).join("\n") ?? "None"}
${(tasks?.length ?? 0) > 50 ? `  ... and ${(tasks?.length ?? 0) - 50} more tasks` : ""}

Risks (${risks?.length ?? 0}):
${risks?.map((r: { title: string; probability: string; impact: string; status: string }) => `  - "${r.title}" [${r.probability}/${r.impact}] ${r.status}`).join("\n") ?? "None"}`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: `[Project Context]\n${context}${kbContext}\n\n[User Message]\n${message}` },
    ];

    const openai = getOpenAI();
    let response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      messages,
      tools,
      tool_choice: "auto",
    });

    const toolResults: string[] = [];

    // Agentic loop — execute all tool calls, then get final response
    while (response.choices[0]?.finish_reason === "tool_calls") {
      const assistantMsg = response.choices[0].message;
      messages.push(assistantMsg);

      const toolCallResults: OpenAI.ChatCompletionToolMessageParam[] = [];

      for (const call of assistantMsg.tool_calls ?? []) {
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const result = await executeTool(call.function.name, args, project_id, supabase);
        toolResults.push(result);
        toolCallResults.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      messages.push(...toolCallResults);

      response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2048,
        messages,
        tools,
        tool_choice: "auto",
      });
    }

    const responseText = response.choices[0]?.message?.content ?? "Done.";

    return NextResponse.json({
      response: responseText,
      actions_taken: toolResults,
      metadata: { model: response.model, usage: response.usage },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      {
        response: "I encountered an error processing your request. Please check that the OPENAI_API_KEY is configured.",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}
