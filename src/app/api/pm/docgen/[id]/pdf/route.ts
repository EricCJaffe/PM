import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { FSA_LOGO_DATA_URI } from "@/lib/fsa-logo-b64";

// POST /api/pm/docgen/[id]/pdf — compile HTML and store
// This compiles the final HTML from template + sections. Actual PDF rendering
// is done client-side via window.print() or a future server-side renderer.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch document with template
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("*, document_types(html_template, css_styles, header_html, footer_html)")
      .eq("id", id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Fetch sections
    const { data: sections } = await supabase
      .from("document_sections")
      .select("*")
      .eq("document_id", id)
      .order("sort_order");

    const dt = (doc as Record<string, unknown>).document_types as Record<string, string> | null;
    let template = dt?.html_template ?? "";
    const css = dt?.css_styles ?? "";
    const intakeData = doc.intake_data as Record<string, string>;

    // Replace simple {{variable}} placeholders with intake data
    for (const [key, value] of Object.entries(intakeData)) {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), escapeHtml(value));
    }

    // Replace {{#each sections}}...{{/each}} block with actual section HTML
    const sectionHtml = (sections ?? [])
      .map((s: Record<string, unknown>) =>
        `<div class="section" id="section-${s.section_key}"><h2>${escapeHtml(s.title as string)}</h2><div class="section-content">${s.content_html}</div></div>`
      )
      .join("\n");

    template = template.replace(/\{\{#each sections\}\}[\s\S]*?\{\{\/each\}\}/g, sectionHtml);

    // Remove any remaining unresolved handlebars helpers
    template = template.replace(/\{\{#if [^}]+\}\}[\s\S]*?\{\{\/if\}\}/g, "");
    template = template.replace(/\{\{[^}]+\}\}/g, "");

    // Build full HTML document
    let compiled = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>${css}</style>
</head><body>${template}</body></html>`;

    // Inline the FSA logo as a base64 data URI so the compiled HTML is
    // fully self-contained — works in DocuSeal, email, print, and the
    // iframe srcDoc preview (relative URLs don't resolve in srcDoc).
    compiled = compiled.replace(
      /src="\/FSA_logo_white\.png"/g,
      `src="${FSA_LOGO_DATA_URI}"`
    );

    // Save compiled HTML
    await supabase
      .from("generated_documents")
      .update({ compiled_html: compiled })
      .eq("id", id);

    return NextResponse.json({ compiled_html: compiled });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
