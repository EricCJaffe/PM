import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

// Map Asana status to our PM status
function mapAsanaStatus(section?: string): "not-started" | "in-progress" | "complete" {
  if (!section) return "not-started";
  const lower = section.toLowerCase();
  if (lower.includes("complete") || lower.includes("done")) return "complete";
  if (lower.includes("progress") || lower.includes("doing") || lower.includes("active")) return "in-progress";
  return "not-started";
}

interface AsanaTask {
  name: string;
  notes?: string;
  completed?: boolean;
  due_on?: string;
  assignee?: { name?: string };
  memberships?: { section?: { name?: string } }[];
  subtasks?: AsanaSubtask[];
}

interface AsanaSubtask {
  name: string;
  completed?: boolean;
}

interface AsanaProject {
  name: string;
  notes?: string;
  sections?: { name: string; tasks: AsanaTask[] }[];
  tasks?: AsanaTask[];
}

// POST: Import an Asana project export (JSON format)
// Accepts the Asana JSON export and creates project/phases/tasks in our system
export async function POST(request: NextRequest) {
  const { org_id, asana_data } = await request.json();

  if (!org_id) return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  if (!asana_data) return NextResponse.json({ error: "asana_data is required" }, { status: 400 });

  const supabase = createServiceClient();

  // Parse Asana export — supports both section-based and flat task lists
  const project: AsanaProject = asana_data;
  const projectName = project.name || "Asana Import";
  const projectSlug = slugify(projectName) + "-" + Date.now().toString(36);

  // Create the project
  const { data: newProject, error: projError } = await supabase
    .from("pm_projects")
    .insert({
      org_id,
      slug: projectSlug,
      name: projectName,
      description: project.notes || "Imported from Asana",
      owner: "",
      template_slug: "custom",
      start_date: new Date().toISOString().slice(0, 10),
      status: "active",
    })
    .select()
    .single();

  if (projError) return NextResponse.json({ error: projError.message }, { status: 500 });

  let taskCount = 0;
  let phaseCount = 0;

  // If sections exist, create phases
  if (project.sections && project.sections.length > 0) {
    for (let i = 0; i < project.sections.length; i++) {
      const section = project.sections[i];
      const phaseSlug = slugify(section.name) || `section-${i}`;

      const { data: phase } = await supabase
        .from("pm_phases")
        .insert({
          project_id: newProject.id,
          slug: phaseSlug,
          name: section.name,
          phase_order: i + 1,
          status: "not-started",
          progress: 0,
        })
        .select()
        .single();

      phaseCount++;

      if (phase && section.tasks) {
        for (let j = 0; j < section.tasks.length; j++) {
          const t = section.tasks[j];
          const subtasks = (t.subtasks || []).map((s) => ({
            text: s.name,
            done: s.completed || false,
          }));

          await supabase.from("pm_tasks").insert({
            project_id: newProject.id,
            phase_id: phase.id,
            slug: slugify(t.name) + "-" + j,
            name: t.name,
            description: t.notes || null,
            status: t.completed ? "complete" : mapAsanaStatus(section.name),
            owner: t.assignee?.name ? slugify(t.assignee.name) : null,
            due_date: t.due_on || null,
            sort_order: j,
            subtasks,
          });
          taskCount++;
        }
      }
    }
  }

  // Flat tasks (no sections)
  if (project.tasks && project.tasks.length > 0) {
    for (let j = 0; j < project.tasks.length; j++) {
      const t = project.tasks[j];
      const sectionName = t.memberships?.[0]?.section?.name;
      const subtasks = (t.subtasks || []).map((s) => ({
        text: s.name,
        done: s.completed || false,
      }));

      await supabase.from("pm_tasks").insert({
        project_id: newProject.id,
        slug: slugify(t.name) + "-" + j,
        name: t.name,
        description: t.notes || null,
        status: t.completed ? "complete" : mapAsanaStatus(sectionName),
        owner: t.assignee?.name ? slugify(t.assignee.name) : null,
        due_date: t.due_on || null,
        sort_order: j,
        subtasks,
      });
      taskCount++;
    }
  }

  return NextResponse.json({
    success: true,
    project_id: newProject.id,
    project_slug: newProject.slug,
    phases_created: phaseCount,
    tasks_created: taskCount,
  });
}
