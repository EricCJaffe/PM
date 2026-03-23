import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/pm/site-audit/[id]/save-doc — Save audit report HTML to client documents
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch the audit
    const { data: audit, error } = await supabase
      .from("pm_site_audits")
      .select("*, pm_organizations(name, slug)")
      .eq("id", id)
      .single();

    if (error || !audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    if (audit.status !== "complete") {
      return NextResponse.json({ error: "Audit is not complete" }, { status: 400 });
    }

    if (audit.document_id) {
      return NextResponse.json({ error: "Report already saved to documents" }, { status: 409 });
    }

    // Generate a lightweight HTML summary and store as a client document
    const orgSlug = audit.pm_organizations?.slug || "org";
    const orgName = audit.pm_organizations?.name || "Organization";
    const domain = audit.url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const dateStr = new Date(audit.created_at).toISOString().split("T")[0];
    const fileName = `${orgSlug}-site-audit-${dateStr}.html`;
    const storagePath = `documents/${orgSlug}/${fileName}`;

    // Build a lightweight HTML summary to store
    const overallGrade = audit.overall?.grade || "?";
    const overallScore = audit.overall?.score || 0;
    const htmlContent = buildStoredReportHTML({
      orgName,
      domain,
      url: audit.url,
      date: dateStr,
      vertical: audit.vertical,
      overallGrade,
      overallScore,
      summary: audit.audit_summary || "",
      auditId: id,
    });

    // Upload to Supabase Storage
    const htmlBuffer = Buffer.from(htmlContent, "utf-8");
    const { error: uploadErr } = await supabase.storage
      .from("vault")
      .upload(storagePath, htmlBuffer, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      // Continue anyway — the document record is more important
    }

    // Create pm_documents record
    const { data: doc, error: docErr } = await supabase
      .from("pm_documents")
      .insert({
        org_id: audit.org_id,
        slug: `site-audit-${dateStr}-${domain.replace(/\./g, "-")}-${id.slice(0, 8)}`,
        title: `Site Audit: ${domain} (${overallGrade} - ${overallScore}%)`,
        category: "report",
        description: `Site audit for ${audit.url} scored ${overallGrade} (${overallScore}/100). ${audit.audit_summary?.slice(0, 200) || ""}`,
        storage_path: storagePath,
        file_name: fileName,
        file_size: htmlBuffer.length,
        mime_type: "text/html",
      })
      .select("id")
      .single();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    // Link document back to audit
    await supabase
      .from("pm_site_audits")
      .update({ document_id: doc.id })
      .eq("id", id);

    return NextResponse.json({ success: true, document_id: doc.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

function buildStoredReportHTML(p: {
  orgName: string;
  domain: string;
  url: string;
  date: string;
  vertical: string;
  overallGrade: string;
  overallScore: number;
  summary: string;
  auditId: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Site Audit — ${esc(p.orgName)} — ${esc(p.date)}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #1a1a2e; }
h1 { font-size: 20px; margin-bottom: 4px; }
.meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
.grade { font-size: 48px; font-weight: bold; text-align: center; margin: 20px 0; }
.summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
.link { color: #2563eb; }
</style>
</head>
<body>
<h1>Site Audit: ${esc(p.domain)}</h1>
<div class="meta">${esc(p.orgName)} &middot; ${esc(p.vertical)} &middot; ${esc(p.date)}</div>
<div class="grade">${esc(p.overallGrade)} (${p.overallScore}%)</div>
<div class="summary"><p>${esc(p.summary)}</p></div>
<p><a class="link" href="/site-audit">Open full interactive report in BusinessOS</a></p>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
