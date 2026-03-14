import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkTablesExist } from "@/lib/db-check";

const REQUIRED_TABLES = ["pm_project_templates", "pm_projects", "pm_phases", "pm_tasks"];

// POST /api/pm/templates/from-project — save a project's current phases/tasks as a template
export async function POST(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) return NextResponse.json(tableCheck, { status: 503 });

    const { project_id, name, slug, description } = await request.json();

    if (!project_id || !name || !slug) {
      return NextResponse.json({ error: "project_id, name, and slug are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get phases for the project
    const { data: phases, error: phaseErr } = await supabase
      .from("pm_phases")
      .select("slug, name, phase_order, \"group\"")
      .eq("project_id", project_id)
      .order("phase_order");

    if (phaseErr) return NextResponse.json({ error: phaseErr.message }, { status: 500 });

    // Get tasks for the project
    const { data: tasks, error: taskErr } = await supabase
      .from("pm_tasks")
      .select("slug, name, description, phase_id")
      .eq("project_id", project_id)
      .order("created_at");

    if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

    // Get phase IDs to map tasks to phase slugs
    const { data: phaseIds } = await supabase
      .from("pm_phases")
      .select("id, slug")
      .eq("project_id", project_id);

    const phaseIdToSlug = new Map((phaseIds ?? []).map((p: { id: string; slug: string }) => [p.id, p.slug]));

    // Build template phases with nested tasks
    interface PhaseRow { slug: string; name: string; phase_order: number; group: string | null }
    interface TaskRow { slug: string; name: string; description: string | null; phase_id: string | null }

    const templatePhases = (phases ?? []).map((phase: PhaseRow) => {
      const phaseSlug = phase.slug;
      const phaseTasks = (tasks ?? [])
        .filter((t: TaskRow) => {
          const taskPhaseSlug = t.phase_id ? phaseIdToSlug.get(t.phase_id) : null;
          return taskPhaseSlug === phaseSlug;
        })
        .map((t: TaskRow) => ({
          slug: t.slug,
          name: t.name,
          ...(t.description ? { description: t.description } : {}),
        }));

      return {
        order: phase.phase_order,
        slug: phase.slug,
        name: phase.name,
        ...(phase.group ? { group: phase.group } : {}),
        ...(phaseTasks.length > 0 ? { tasks: phaseTasks } : {}),
      };
    });

    // Insert the template
    const { data, error } = await supabase
      .from("pm_project_templates")
      .insert({
        slug,
        name,
        description: description || "",
        phases: templatePhases,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Template slug '${slug}' already exists` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
