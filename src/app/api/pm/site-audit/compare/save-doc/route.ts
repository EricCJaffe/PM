import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBranding, buildPreparedBy } from "@/lib/branding";

// POST /api/pm/site-audit/compare/save-doc — Save comparison PDF to client docs
// Accepts FormData with "pdf" file, "audit_id_before", "audit_id_after"
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File | null;
    const auditIdBefore = formData.get("audit_id_before") as string | null;
    const auditIdAfter = formData.get("audit_id_after") as string | null;

    if (!pdfFile || !auditIdBefore || !auditIdAfter) {
      return NextResponse.json(
        { error: "pdf, audit_id_before, and audit_id_after are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch both audits for metadata
    const [beforeRes, afterRes] = await Promise.all([
      supabase
        .from("pm_site_audits")
        .select("*, pm_organizations(name, slug)")
        .eq("id", auditIdBefore)
        .single(),
      supabase
        .from("pm_site_audits")
        .select("*, pm_organizations(name, slug)")
        .eq("id", auditIdAfter)
        .single(),
    ]);

    if (beforeRes.error || !beforeRes.data || afterRes.error || !afterRes.data) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    const before = beforeRes.data;
    const after = afterRes.data;
    const orgSlug = after.pm_organizations?.slug || "prospect";
    const orgName = after.pm_organizations?.name || after.prospect_name || "Organization";
    const domain = after.url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const beforeDate = new Date(before.created_at).toISOString().split("T")[0];
    const afterDate = new Date(after.created_at).toISOString().split("T")[0];

    // Block save-to-docs for prospect audits
    if (!after.org_id) {
      return NextResponse.json(
        { error: "Cannot save to client docs for prospect audits — no organization linked" },
        { status: 400 }
      );
    }

    const branding = await getBranding(after.org_id);
    const agencyName = buildPreparedBy(branding);

    const overallBefore = before.overall || { grade: "?", score: 0 };
    const overallAfter = after.overall || { grade: "?", score: 0 };

    // Upload PDF to storage
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    const pdfFileName = `${orgSlug}-audit-comparison-${afterDate}.pdf`;
    const pdfStoragePath = `documents/${orgSlug}/${pdfFileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("vault")
      .upload(pdfStoragePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("PDF upload error:", uploadErr);
      return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
    }

    // Create pm_documents record
    const { data: doc, error: docErr } = await supabase
      .from("pm_documents")
      .insert({
        org_id: after.org_id,
        slug: `audit-comparison-${beforeDate}-vs-${afterDate}-${domain.replace(/\./g, "-")}`,
        title: `Site Audit Comparison: ${domain} (${overallBefore.grade} → ${overallAfter.grade})`,
        category: "report",
        description: `Audit comparison for ${after.url}: ${overallBefore.grade} (${overallBefore.score}%) → ${overallAfter.grade} (${overallAfter.score}%). ${beforeDate} vs ${afterDate}. Prepared by ${agencyName}.`,
        storage_path: pdfStoragePath,
        file_name: pdfFileName,
        file_size: pdfBuffer.length,
        mime_type: "application/pdf",
      })
      .select("id")
      .single();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, document_id: doc.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
