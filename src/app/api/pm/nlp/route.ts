import { NextRequest, NextResponse } from "next/server";
import type OpenAI from "openai";
import { getOpenAI } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a task management NLP parser. Convert natural language instructions into specific database operations.

You have these tools available:
- update_task: Update a task's status, owner, due date, or description
- update_multiple_tasks: Update multiple tasks at once (batch operations)
- add_task: Create a new task
- complete_task: Mark a task as complete
- block_task: Mark a task as blocked with a reason

IMPORTANT RULES:
- Match task names flexibly — use the closest match from the context
- For dates, convert relative expressions: "tomorrow" = next day, "next Monday", "end of week", "April 15" etc.
- For status updates, map natural language: "done"/"finished"/"completed" = "complete", "stuck"/"waiting" = "blocked", "working on"/"started" = "in-progress", "paused"/"hold" = "on-hold"
- For owner assignments, match against the member list provided
- Always confirm what you did in plain language after executing

Today's date is: ${new Date().toISOString().split("T")[0]}`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update a single task's fields",
      parameters: {
        type: "object",
        properties: {
          task_name: { type: "string", description: "Name or partial name of the task to find" },
          status: { type: "string", enum: ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] },
          owner: { type: "string", description: "New owner slug or name" },
          due_date: { type: "string", description: "New due date in YYYY-MM-DD format" },
          description: { type: "string", description: "Updated description" },
        },
        required: ["task_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_multiple_tasks",
      description: "Update multiple tasks at once with the same change",
      parameters: {
        type: "object",
        properties: {
          task_names: { type: "array", items: { type: "string" }, description: "Names of tasks to update" },
          status: { type: "string", enum: ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] },
          owner: { type: "string" },
          due_date: { type: "string" },
        },
        required: ["task_names"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_task",
      description: "Create a new task",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Task name" },
          status: { type: "string", enum: ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] },
          owner: { type: "string" },
          due_date: { type: "string" },
          description: { type: "string" },
          project_id: { type: "string", description: "Project ID (from context)" },
          org_id: { type: "string", description: "Org ID (from context)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark a task as complete",
      parameters: {
        type: "object",
        properties: {
          task_name: { type: "string", description: "Name of the task to complete" },
        },
        required: ["task_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "block_task",
      description: "Mark a task as blocked",
      parameters: {
        type: "object",
        properties: {
          task_name: { type: "string", description: "Name of the task" },
          reason: { type: "string", description: "Why it's blocked" },
        },
        required: ["task_name"],
      },
    },
  },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceClient>,
  contextProjectId?: string | null,
  contextOrgId?: string | null,
): Promise<string> {
  try {
    if (name === "update_task" || name === "complete_task" || name === "block_task") {
      const taskName = (args.task_name as string) || "";

      // Build query — search across all tasks the user might mean
      let query = supabase.from("pm_tasks").select("id, name").ilike("name", `%${taskName}%`);
      if (contextProjectId) query = query.eq("project_id", contextProjectId);
      else if (contextOrgId) query = query.eq("org_id", contextOrgId);

      const { data: task } = await query.limit(1).single();
      if (!task) return `Task matching "${taskName}" not found.`;

      const updates: Record<string, unknown> = {};
      if (name === "complete_task") {
        updates.status = "complete";
      } else if (name === "block_task") {
        updates.status = "blocked";
        if (args.reason) updates.description = args.reason;
      } else {
        if (args.status) updates.status = args.status;
        if (args.owner) updates.owner = args.owner;
        if (args.due_date) updates.due_date = args.due_date;
        if (args.description) updates.description = args.description;
      }

      const { error } = await supabase.from("pm_tasks").update(updates).eq("id", task.id);
      if (error) return `Failed to update "${task.name}": ${error.message}`;

      const changeDesc = Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(", ");
      return `Updated "${task.name}": ${changeDesc}`;
    }

    if (name === "update_multiple_tasks") {
      const taskNames = (args.task_names as string[]) || [];
      const results: string[] = [];

      for (const taskName of taskNames) {
        let query = supabase.from("pm_tasks").select("id, name").ilike("name", `%${taskName}%`);
        if (contextProjectId) query = query.eq("project_id", contextProjectId);
        else if (contextOrgId) query = query.eq("org_id", contextOrgId);

        const { data: task } = await query.limit(1).single();
        if (!task) { results.push(`"${taskName}" not found`); continue; }

        const updates: Record<string, unknown> = {};
        if (args.status) updates.status = args.status;
        if (args.owner) updates.owner = args.owner;
        if (args.due_date) updates.due_date = args.due_date;

        const { error } = await supabase.from("pm_tasks").update(updates).eq("id", task.id);
        if (error) { results.push(`"${task.name}" failed: ${error.message}`); continue; }
        results.push(`"${task.name}" updated`);
      }
      return results.join("; ");
    }

    if (name === "add_task") {
      const slug = slugify(args.name as string);
      const projectId = (args.project_id as string) || contextProjectId || null;
      const orgId = (args.org_id as string) || contextOrgId || null;

      const { error } = await supabase.from("pm_tasks").insert({
        project_id: projectId,
        org_id: orgId,
        slug,
        name: args.name,
        status: (args.status as string) || "not-started",
        owner: (args.owner as string) || null,
        due_date: (args.due_date as string) || null,
        description: (args.description as string) || null,
      });
      if (error) return `Failed to create task: ${error.message}`;
      return `Created task "${args.name}"${args.due_date ? ` due ${args.due_date}` : ""}${args.owner ? ` assigned to ${args.owner}` : ""}.`;
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// POST /api/pm/nlp — Process natural language update
// Body: { message, project_id?, org_id? }
export async function POST(request: NextRequest) {
  try {
    const { message, project_id, org_id } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Build task context for the AI
    let taskContext = "";
    let memberContext = "";

    if (project_id) {
      const { data: tasks } = await supabase
        .from("pm_tasks")
        .select("name, status, owner, due_date")
        .eq("project_id", project_id)
        .limit(100);

      taskContext = `\nTasks in this project:\n${tasks?.map((t: { name: string; status: string; owner: string; due_date: string }) => `  - "${t.name}" [${t.status}] owner:${t.owner ?? "—"} due:${t.due_date ?? "—"}`).join("\n") ?? "  None"}`;

      // Get project's org for member lookup
      const { data: project } = await supabase.from("pm_projects").select("org_id").eq("id", project_id).single();
      if (project?.org_id) {
        const { data: members } = await supabase
          .from("pm_members")
          .select("slug, display_name")
          .eq("org_id", project.org_id);
        memberContext = `\nTeam members:\n${members?.map((m: { slug: string; display_name: string }) => `  - ${m.display_name} (slug: ${m.slug})`).join("\n") ?? "  None"}`;
      }
    } else if (org_id) {
      const { data: tasks } = await supabase
        .from("pm_tasks")
        .select("name, status, owner, due_date")
        .eq("org_id", org_id)
        .is("project_id", null)
        .limit(50);

      taskContext = `\nClient-level tasks:\n${tasks?.map((t: { name: string; status: string; owner: string; due_date: string }) => `  - "${t.name}" [${t.status}] owner:${t.owner ?? "—"} due:${t.due_date ?? "—"}`).join("\n") ?? "  None"}`;
    } else {
      // Dashboard-level — get user's tasks across all projects
      const { data: tasks } = await supabase
        .from("pm_tasks")
        .select("name, status, owner, due_date, project_id, org_id")
        .neq("status", "complete")
        .limit(50);

      taskContext = `\nAll open tasks:\n${tasks?.map((t: { name: string; status: string; owner: string; due_date: string }) => `  - "${t.name}" [${t.status}] owner:${t.owner ?? "—"} due:${t.due_date ?? "—"}`).join("\n") ?? "  None"}`;
    }

    const openai = getOpenAI();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${taskContext}${memberContext}\n\nUser instruction: "${message}"\n\nParse this instruction and execute the appropriate tool call(s). If the instruction is ambiguous, make your best guess from context.${project_id ? `\nContext project_id: ${project_id}` : ""}${org_id ? `\nContext org_id: ${org_id}` : ""}`,
      },
    ];

    let response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      temperature: 0.2,
      messages,
      tools,
      tool_choice: "auto",
    });

    const results: string[] = [];

    // Execute tool calls
    while (response.choices[0]?.finish_reason === "tool_calls") {
      const assistantMsg = response.choices[0].message;
      messages.push(assistantMsg);

      const toolCallResults: OpenAI.ChatCompletionToolMessageParam[] = [];

      for (const call of assistantMsg.tool_calls ?? []) {
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const result = await executeTool(call.function.name, args, supabase, project_id, org_id);
        results.push(result);
        toolCallResults.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      messages.push(...toolCallResults);

      response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 512,
        temperature: 0.2,
        messages,
        tools,
        tool_choice: "auto",
      });
    }

    const responseText = response.choices[0]?.message?.content ?? "Done.";

    return NextResponse.json({
      response: responseText,
      actions: results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
