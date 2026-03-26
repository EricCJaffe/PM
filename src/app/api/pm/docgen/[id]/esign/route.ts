import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createSubmissionFromHtml,
  getSubmission,
  archiveSubmission,
  injectSignatureFields,
} from "@/lib/esign";

// POST /api/pm/docgen/[id]/esign — Send document for eSignature via DocuSeal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch document with compiled HTML
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("*, document_types(name)")
      .eq("id", id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.compiled_html) {
      return NextResponse.json(
        { error: "Document must be compiled before sending for signature. Go to Sections > Compile & Preview first." },
        { status: 400 }
      );
    }

    if (doc.esign_document_hash && doc.esign_status === "waiting") {
      return NextResponse.json(
        { error: "Document is already pending signature. Cancel the existing request first." },
        { status: 400 }
      );
    }

    // Extract signer info from intake data
    const intake = doc.intake_data as Record<string, string>;
    const clientName = intake.client_contact_name || intake.client_name || "Client";
    const clientEmail = intake.client_contact_email;
    const providerName = intake.prepared_by || "Foundation Stone Advisors";

    if (!clientEmail) {
      return NextResponse.json(
        { error: "Client contact email is required in the intake form to send for signature." },
        { status: 400 }
      );
    }

    // Allow optional override from request body
    const body = await request.json().catch(() => ({}));
    const providerEmail = body.provider_email;

    const clientRole = "Client";
    const providerRole = "Provider";

    // Build submitter list
    const submitters = [
      { name: clientName, email: clientEmail, role: clientRole },
    ];
    if (providerEmail) {
      submitters.push({ name: providerName, email: providerEmail, role: providerRole });
    }

    const dt = (doc as Record<string, unknown>).document_types as { name: string } | null;
    const docTypeName = dt?.name || "Document";

    // Inject DocuSeal signature/date/name field tags into the HTML
    // This replaces the static signature block with interactive fields
    const htmlWithFields = injectSignatureFields(
      doc.compiled_html as string,
      clientName,
      clientRole,
      providerEmail ? providerName : undefined,
      providerEmail ? providerRole : undefined,
    );

    // Send to DocuSeal — creates submission from HTML with embedded field tags
    const result = await createSubmissionFromHtml({
      name: `${doc.title} — ${docTypeName}`,
      documents: [{ name: `${doc.title} — ${docTypeName}`, html: htmlWithFields }],
      submitters,
      order: submitters.length > 1 ? "preserved" : undefined,
      send_email: true,
      message: `Please review and sign this ${docTypeName}. If you have any questions, please contact ${providerName}.`,
    });

    // Normalize result to array (createSubmissionFromHtml already does this,
    // but guard against unexpected shapes)
    const resultSubmitters = Array.isArray(result) ? result : [result];
    const submissionId = resultSubmitters[0]?.id;

    // Update document with eSign tracking data
    // We store the first submitter ID as the document hash for lookups
    const { error: updateErr } = await supabase
      .from("generated_documents")
      .update({
        esign_provider: "docuseal",
        esign_document_hash: String(submissionId),
        esign_status: "waiting",
        esign_sent_at: new Date().toISOString(),
        esign_signers: resultSubmitters.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          status: s.status || "pending",
          signed: false,
        })),
        esign_metadata: {
          submitter_ids: resultSubmitters.map((s) => s.id),
          embed_srcs: resultSubmitters.map((s) => ({ email: s.email, embed_src: s.embed_src })),
        },
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("Failed to update document after eSign:", updateErr);
    }

    // Log activity
    await supabase.from("document_activity").insert({
      document_id: id,
      action: "esign_sent",
      details: {
        provider: "docuseal",
        submission_id: submissionId,
        signers: resultSubmitters.map((s) => ({ name: s.name, email: s.email })),
      },
    });

    return NextResponse.json({
      success: true,
      submission_id: submissionId,
      signers: resultSubmitters.map((s) => ({ name: s.name, email: s.email, status: s.status })),
    });
  } catch (err) {
    console.error("eSign error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send for signature" },
      { status: 500 }
    );
  }
}

// GET /api/pm/docgen/[id]/esign — Check eSign status from DocuSeal
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("esign_provider, esign_document_hash, esign_status, esign_sent_at, esign_completed_at, esign_signers, esign_metadata")
      .eq("id", id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.esign_document_hash) {
      return NextResponse.json({ esign_status: null, message: "Not sent for signature" });
    }

    // Fetch live status from DocuSeal
    const meta = doc.esign_metadata as Record<string, unknown> | null;
    const submitterIds = (meta?.submitter_ids || []) as number[];

    // Use the first submitter ID to get the full submission
    if (submitterIds.length === 0) {
      return NextResponse.json({
        esign_status: doc.esign_status,
        esign_sent_at: doc.esign_sent_at,
        esign_completed_at: doc.esign_completed_at,
        signers: doc.esign_signers,
        cached: true,
      });
    }

    try {
      const submission = await getSubmission(submitterIds[0]);

      // Map DocuSeal statuses to our normalized statuses
      const signerUpdates = submission.submitters.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        status: s.status === "completed" ? "signed" : s.status,
        signed: s.status === "completed",
        signed_at: s.completed_at,
      }));

      let esignStatus = "waiting";
      if (submission.status === "completed") esignStatus = "signed";
      else if (submission.status === "declined") esignStatus = "declined";
      else if (submission.status === "expired") esignStatus = "expired";
      else if (submission.submitters.some((s) => s.status === "declined")) esignStatus = "declined";

      const updates: Record<string, unknown> = {
        esign_status: esignStatus,
        esign_signers: signerUpdates,
      };

      if (esignStatus === "signed" && !doc.esign_completed_at) {
        updates.esign_completed_at = submission.completed_at;
        updates.signed_at = submission.completed_at;
        updates.status = "signed";
      } else if (esignStatus === "declined") {
        updates.status = "draft";
      }

      await supabase.from("generated_documents").update(updates).eq("id", id);

      return NextResponse.json({
        esign_status: esignStatus,
        esign_sent_at: doc.esign_sent_at,
        esign_completed_at: updates.esign_completed_at || doc.esign_completed_at,
        signers: signerUpdates,
        documents: submission.documents,
        audit_log_url: submission.audit_log_url,
      });
    } catch {
      // If DocuSeal API fails, return cached data
      return NextResponse.json({
        esign_status: doc.esign_status,
        esign_sent_at: doc.esign_sent_at,
        esign_completed_at: doc.esign_completed_at,
        signers: doc.esign_signers,
        cached: true,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// DELETE /api/pm/docgen/[id]/esign — Cancel (archive) eSign request
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("esign_document_hash, esign_status, esign_metadata")
      .eq("id", id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.esign_document_hash) {
      return NextResponse.json({ error: "No eSign request to cancel" }, { status: 400 });
    }

    if (doc.esign_status === "signed") {
      return NextResponse.json({ error: "Cannot cancel a signed document" }, { status: 400 });
    }

    // Archive in DocuSeal using first submitter ID
    const meta = doc.esign_metadata as Record<string, unknown> | null;
    const submitterIds = (meta?.submitter_ids || []) as number[];
    if (submitterIds.length > 0) {
      await archiveSubmission(submitterIds[0]);
    }

    // Update local status
    await supabase
      .from("generated_documents")
      .update({
        esign_status: "cancelled",
        status: "draft",
      })
      .eq("id", id);

    await supabase.from("document_activity").insert({
      document_id: id,
      action: "esign_cancelled",
      details: { submission_id: doc.esign_document_hash },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel" },
      { status: 500 }
    );
  }
}
