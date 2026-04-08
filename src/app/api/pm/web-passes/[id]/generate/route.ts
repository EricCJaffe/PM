import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { getBranding } from "@/lib/branding";
import { webPassLimiter, rateLimitExceeded } from "@/lib/ratelimit";

// POST /api/pm/web-passes/[id]/generate — generate mockup HTML for a pass
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: pass, error } = await supabase
    .from("pm_web_passes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !pass) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 });
  }

  // SEC-005: Rate limit by org ID (10 generate/score calls per hour)
  const { success: rlOk } = await webPassLimiter.limit(`gen:${pass.org_id}`);
  if (!rlOk) return rateLimitExceeded();

  const branding = await getBranding(pass.org_id);
  const form = pass.form_data as Record<string, unknown>;

  const openai = getOpenAI();

  if (pass.pass_type === "foundation") {
    // Pass 1: generate two styled HTML mockup variants from brand/page data
    const prompt = buildPass1Prompt(form, branding as unknown as Record<string, unknown>);

    const [resA, resB] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a web designer generating complete, styled single-page HTML mockups. Return ONLY valid HTML — no markdown, no backticks, no explanation." },
          { role: "user", content: `${prompt}\n\nDesign Style: Option A — Clean, minimal, professional. High white space, sans-serif, muted tones with one accent color.` },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a web designer generating complete, styled single-page HTML mockups. Return ONLY valid HTML — no markdown, no backticks, no explanation." },
          { role: "user", content: `${prompt}\n\nDesign Style: Option B — Bold, expressive, full-width sections. Strong typography, brand color backgrounds, high visual contrast.` },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    ]);

    const htmlA = resA.choices[0].message.content ?? "";
    const htmlB = resB.choices[0].message.content ?? "";

    const { data: updated } = await supabase
      .from("pm_web_passes")
      .update({ deliverable_html: htmlA, deliverable_html_b: htmlB, status: "in-review" })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json({ pass: updated, options: ["a", "b"] });
  }

  if (pass.pass_type === "content") {
    // Pass 2: re-render selected option with real client content
    const selectedHtml = pass.selected_option === "b" ? pass.deliverable_html_b : pass.deliverable_html;
    const contentData = JSON.stringify(form.pages ?? {});

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a web developer updating an HTML mockup with real client content. Replace placeholder text and images with the provided content. Preserve all styling. Return ONLY valid HTML." },
        { role: "user", content: `Update this HTML mockup with the real content below.\n\nHTML:\n${selectedHtml}\n\nContent:\n${contentData}` },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    });

    const html = res.choices[0].message.content ?? "";
    const { data: updated } = await supabase
      .from("pm_web_passes")
      .update({ deliverable_html: html, status: "in-review" })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json({ pass: updated });
  }

  if (pass.pass_type === "polish") {
    // Pass 3: apply section comments + add SEO/schema markup
    const { data: comments } = await supabase
      .from("pm_web_pass_comments")
      .select("*")
      .eq("pass_id", id)
      .eq("is_resolved", false)
      .neq("feedback_type", "approve");

    const commentSummary = (comments ?? [])
      .map((c: { section_label: string | null; section_id: string; comment: string | null }) =>
        `Section "${c.section_label ?? c.section_id}": ${c.comment}`)
      .join("\n");

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a senior web developer applying client feedback and SEO enhancements to an HTML page. Apply all requested changes. Add appropriate meta tags, structured data (schema.org JSON-LD), and semantic HTML where missing. Return ONLY valid HTML." },
        { role: "user", content: `Apply these client feedback items to the HTML, then add SEO meta tags and schema markup.\n\nFeedback:\n${commentSummary || "No feedback — just add SEO/schema."}\n\nHTML:\n${pass.deliverable_html}` },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    });

    const html = res.choices[0].message.content ?? "";

    // Mark all non-approve comments as ai_applied
    await supabase
      .from("pm_web_pass_comments")
      .update({ ai_applied: true, is_resolved: true, resolved_by: "AI", resolved_at: new Date().toISOString() })
      .eq("pass_id", id)
      .eq("is_resolved", false);

    const { data: updated } = await supabase
      .from("pm_web_passes")
      .update({ deliverable_html: html, status: "in-review" })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json({ pass: updated });
  }

  return NextResponse.json({ error: `Generation not supported for pass type: ${pass.pass_type}` }, { status: 400 });
}

function buildPass1Prompt(form: Record<string, unknown>, branding: Record<string, unknown>): string {
  const name = (form.business_name as string) || (branding.platform_name as string) || "Your Business";
  const tagline = (form.tagline as string) || "";
  const vertical = (form.vertical as string) || "general";
  const pages = (form.pages as string[]) || ["home", "about", "contact"];
  const audience = (form.target_audience as string) || "";
  const colors = (form.brand_colors as { primary: string; secondary: string }) || { primary: "#2563eb", secondary: "#1e293b" };

  return `Create a single-page HTML mockup for a ${vertical} website.

Business: ${name}
Tagline: ${tagline}
Pages to include as sections: ${pages.join(", ")}
Target audience: ${audience}
Brand colors: primary=${colors.primary}, secondary=${colors.secondary}

Requirements:
- Inline CSS only (no external stylesheets)
- Full responsive layout using CSS flexbox/grid
- Include: navigation bar, hero section, each page as a scroll section, footer
- Use placeholder images from https://placehold.co/ (e.g. https://placehold.co/800x400)
- Use realistic placeholder copy appropriate for ${vertical}
- Mark each section with data-section-id="[section-name]" for client review`;
}
