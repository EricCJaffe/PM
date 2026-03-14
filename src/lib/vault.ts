import matter from "gray-matter";
import { createServiceClient } from "./supabase/server";

const VAULT_BUCKET = "vault";

// ─── Path Helpers ────────────────────────────────────────────────────

export function projectBasePath(orgSlug: string, projectSlug: string) {
  return `${orgSlug}/${projectSlug}`;
}

export function phasePath(orgSlug: string, projectSlug: string, phaseSlug: string) {
  return `${projectBasePath(orgSlug, projectSlug)}/phases/${phaseSlug}`;
}

export function taskPath(orgSlug: string, projectSlug: string, taskSlug: string) {
  return `${projectBasePath(orgSlug, projectSlug)}/tasks/t-${taskSlug}.md`;
}

export function reportPath(orgSlug: string, projectSlug: string, filename: string) {
  return `${projectBasePath(orgSlug, projectSlug)}/ai/reports/${filename}`;
}

export function dailyPath(orgSlug: string, projectSlug: string, date: string) {
  return `${projectBasePath(orgSlug, projectSlug)}/daily/${date}.md`;
}

// ─── Read / Write ────────────────────────────────────────────────────

export async function readVaultFile(path: string): Promise<{ frontmatter: Record<string, unknown>; content: string } | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(VAULT_BUCKET)
    .download(path);

  if (error || !data) return null;

  const text = await data.text();
  const parsed = matter(text);

  return {
    frontmatter: parsed.data as Record<string, unknown>,
    content: parsed.content,
  };
}

export async function writeVaultFile(
  path: string,
  frontmatter: Record<string, unknown>,
  content: string
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  const md = matter.stringify(content, frontmatter);

  const { error } = await supabase.storage
    .from(VAULT_BUCKET)
    .upload(path, new Blob([md], { type: "text/markdown" }), {
      upsert: true,
    });

  return { error: error?.message ?? null };
}

export async function deleteVaultFile(path: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.storage.from(VAULT_BUCKET).remove([path]);
}

// ─── Vault Structure Generation ─────────────────────────────────────

export interface VaultFileSpec {
  path: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export function generateProjectVaultFiles(
  orgSlug: string,
  projectSlug: string,
  project: {
    name: string;
    description: string;
    owner: string;
    template: string;
    start: string;
    target: string | null;
    budget: number | null;
    status: string;
    phases: string[];
  }
): VaultFileSpec[] {
  const base = projectBasePath(orgSlug, projectSlug);
  const files: VaultFileSpec[] = [];

  // PROJECT.md
  files.push({
    path: `${base}/PROJECT.md`,
    frontmatter: {
      name: project.name,
      description: project.description,
      org: orgSlug,
      owner: `[[${project.owner}]]`,
      template: project.template,
      start: project.start,
      target: project.target,
      budget: project.budget,
      status: project.status,
      phases: project.phases,
    },
    content: `# ${project.name}\n\n${project.description}\n`,
  });

  // RISKS.md
  files.push({
    path: `${base}/RISKS.md`,
    frontmatter: { project: projectSlug },
    content: `# Risk Register: ${project.name}\n\n_No risks logged yet._\n`,
  });

  // DECISIONS.md
  files.push({
    path: `${base}/DECISIONS.md`,
    frontmatter: { project: projectSlug },
    content: `# Decisions: ${project.name}\n\n_No decisions logged yet._\n`,
  });

  // STATUS.md
  files.push({
    path: `${base}/STATUS.md`,
    frontmatter: {
      project: projectSlug,
      status: project.status,
      last_updated: project.start,
      progress: 0,
    },
    content: `# Status: ${project.name}\n\n## Current State\n- **Status:** ${project.status}\n- **Owner:** ${project.owner}\n- **Last Updated:** ${project.start}\n- **Progress:** 0%\n\n## What's Done\n\n_Project just initialized._\n\n## What's Next\n\n## Blockers\n\n_None._\n\n## Notes\n`,
  });

  // AI prompts placeholder
  files.push({
    path: `${base}/ai/prompts.md`,
    frontmatter: { project: projectSlug },
    content: `# AI Prompts: ${project.name}\n\nCustom prompts and instructions for AI-generated reports.\n`,
  });

  return files;
}

export function generatePhaseVaultFiles(
  orgSlug: string,
  projectSlug: string,
  phase: { slug: string; name: string; order?: number; phase_order?: number; group?: string }
): VaultFileSpec[] {
  const ord = phase.phase_order ?? phase.order ?? 0;
  const base = phasePath(orgSlug, projectSlug, `p${String(ord).padStart(2, "0")}-${phase.slug}`);
  return [
    {
      path: `${base}/STATUS.md`,
      frontmatter: { phase: phase.slug, status: "not-started", progress: 0 },
      content: `# Status: ${phase.name}\n\n## Current State\n- **Status:** not-started\n- **Progress:** 0%\n\n## What's Done\n\n## What's Next\n\n## Blockers\n\n## Notes\n`,
    },
    {
      path: `${base}/DECISIONS.md`,
      frontmatter: { phase: phase.slug },
      content: `# Decisions: ${phase.name}\n`,
    },
    {
      path: `${base}/RESOURCES.md`,
      frontmatter: { phase: phase.slug },
      content: `# Resources: ${phase.name}\n\n## Tools & Platforms\n\n## Reference Material\n\n## Vendor Info\n\n## Key Contacts\n`,
    },
  ];
}

export function generateTaskVaultFile(
  orgSlug: string,
  projectSlug: string,
  task: {
    slug: string;
    name: string;
    project: string;
    phase?: string;
    owner?: string;
    status: string;
    due?: string;
    dependsOn?: string[];
    risk?: string;
    subtasks?: { text: string; done: boolean }[];
  }
): VaultFileSpec {
  const subtasksMd = task.subtasks?.length
    ? task.subtasks.map((s) => `- [${s.done ? "x" : " "}] ${s.text}`).join("\n")
    : "";

  return {
    path: taskPath(orgSlug, projectSlug, task.slug),
    frontmatter: {
      id: `t-${task.slug}`,
      project: `[[${task.project}]]`,
      ...(task.phase && { phase: `[[${task.phase}]]` }),
      ...(task.owner && { owner: `[[${task.owner}]]` }),
      status: task.status,
      ...(task.due && { due: task.due }),
      ...(task.dependsOn?.length && { "depends-on": task.dependsOn.map((d) => `[[${d}]]`) }),
      ...(task.risk && { risk: `[[${task.risk}]]` }),
    },
    content: `## Notes\n\n## Subtasks\n${subtasksMd}\n`,
  };
}

export async function writeAllVaultFiles(files: VaultFileSpec[]): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  for (const file of files) {
    const { error } = await writeVaultFile(file.path, file.frontmatter, file.content);
    if (error) errors.push(`${file.path}: ${error}`);
  }
  return { errors };
}
