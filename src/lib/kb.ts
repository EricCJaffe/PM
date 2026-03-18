import { createServiceClient } from "./supabase/server";
import type { KBArticle } from "@/types/pm";

const CATEGORY_LABELS: Record<string, string> = {
  "company-profile": "Company Profile",
  "client-profile": "Client Profile",
  "strategy": "Strategy & Decisions",
  "playbook": "Playbook & Process",
  "lessons-learned": "Lessons Learned",
  "industry": "Industry Knowledge",
  "relationship": "Relationship Context",
  "general": "General Knowledge",
};

/**
 * Assemble KB context for AI consumption.
 * Cascades: global → org → project (most specific wins if space is tight).
 * Returns a formatted string ready for injection into system prompts.
 *
 * @param orgId   - Client org ID (optional, adds org-scoped articles)
 * @param projectId - Project ID (optional, adds project-scoped articles)
 * @param maxChars - Max characters to return (default 8000, ~2K tokens)
 */
export async function assembleKBContext(
  orgId?: string | null,
  projectId?: string | null,
  maxChars = 8000
): Promise<string> {
  const supabase = createServiceClient();

  // Fetch all applicable articles in one query
  const conditions: string[] = ["org_id.is.null"]; // always include global
  if (orgId) {
    conditions.push(`and(org_id.eq.${orgId},project_id.is.null)`);
  }
  if (projectId) {
    conditions.push(`project_id.eq.${projectId}`);
  }

  const { data } = await supabase
    .from("pm_kb_articles")
    .select("title, category, content, org_id, project_id, is_pinned, tags")
    .or(conditions.join(","))
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  const articles = (data ?? []) as Pick<KBArticle, "title" | "category" | "content" | "org_id" | "project_id" | "is_pinned" | "tags">[];

  if (!articles.length) return "";

  // Group by scope tier for clear hierarchy
  const global = articles.filter((a) => a.org_id === null);
  const org = articles.filter((a) => a.org_id !== null && a.project_id === null);
  const project = articles.filter((a) => a.project_id !== null);

  const sections: string[] = [];
  let totalChars = 0;

  function addSection(label: string, items: typeof articles) {
    if (!items.length || totalChars >= maxChars) return;
    const lines: string[] = [`## ${label}`];
    for (const article of items) {
      if (totalChars >= maxChars) break;
      const catLabel = CATEGORY_LABELS[article.category] || article.category;
      const entry = `### ${article.title} [${catLabel}]${article.is_pinned ? " ★" : ""}\n${article.content}`;
      if (totalChars + entry.length > maxChars) {
        // Truncate last article to fit
        const remaining = maxChars - totalChars - lines.join("\n").length - 50;
        if (remaining > 200) {
          lines.push(`### ${article.title} [${catLabel}]\n${article.content.slice(0, remaining)}...\n[truncated]`);
          totalChars = maxChars;
        }
        break;
      }
      lines.push(entry);
      totalChars += entry.length;
    }
    if (lines.length > 1) sections.push(lines.join("\n"));
  }

  // Pinned first across all scopes, then by scope
  const pinned = articles.filter((a) => a.is_pinned);
  if (pinned.length) {
    addSection("Key Context (Pinned)", pinned);
  }

  addSection("Company Knowledge", global.filter((a) => !a.is_pinned));
  addSection("Client Knowledge", org.filter((a) => !a.is_pinned));
  addSection("Project Knowledge", project.filter((a) => !a.is_pinned));

  if (!sections.length) return "";

  return `\n\n─── KNOWLEDGE BASE CONTEXT ───\nThe following is institutional knowledge that should inform your responses, decisions, and recommendations. Treat this as authoritative context about the company, its clients, and how business is conducted.\n\n${sections.join("\n\n")}`;
}
