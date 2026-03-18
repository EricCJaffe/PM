import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createDocument, getDocument, cancelDocument } from "@/lib/esign";

// POST /api/pm/docgen/[id]/esign — Send document for eSignature via Xodo Sign
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

    // Build signer list
    const signers = [
      { id: 1, name: clientName, email: clientEmail, order: 1 },
    ];

    // If provider email is given, add as second signer
    if (providerEmail) {
      signers.push({ id: 2, name: providerName, email: providerEmail, order: 2 });
    }

    // Convert compiled HTML to base64 for Xodo Sign
    const htmlBase64 = Buffer.from(doc.compiled_html as string).toString("base64");

    const dt = (doc as Record<string, unknown>).document_types as { name: string } | null;
    const docTypeName = dt?.name || "Document";

    // Send to Xodo Sign
    const result = await createDocument({
      title: `${doc.title} — ${docTypeName}`,
      message: `Please review and sign this ${docTypeName}. If you have any questions, please contact ${providerName}.`,
      fileBase64: htmlBase64,
      fileName: `${doc.title.replace(/[^a-zA-Z0-9-_ ]/g, "")}.html`,
      signers,
      useSignerOrder: signers.length > 1,
      reminders: true,
    });

    // Update document with eSign tracking data
    const { error: updateErr } = await supabase
      .from("generated_documents")
      .update({
        esign_provider: "xodo",
        esign_document_hash: result.document_hash,
        esign_status: "waiting",
        esign_sent_at: new Date().toISOString(),
        esign_signers: result.signers.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          status: s.status || "waiting_for_signature",
          signed: false,
        })),
        esign_metadata: {
          created: result.created,
          expires: result.expires,
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
        provider: "xodo",
        document_hash: result.document_hash,
        signers: result.signers.map((s) => ({ name: s.name, email: s.email })),
      },
    });

    return NextResponse.json({
      success: true,
      document_hash: result.document_hash,
      signers: result.signers.map((s) => ({ name: s.name, email: s.email, status: s.status })),
    });
  } catch (err) {
    console.error("eSign error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send for signature" },
      { status: 500 }
    );
  }
}

// GET /api/pm/docgen/[id]/esign — Check eSign status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("esign_provider, esign_document_hash, esign_status, esign_sent_at, esign_completed_at, esign_signers")
      .eq("id", id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.esign_document_hash) {
      return NextResponse.json({ esign_status: null, message: "Not sent for signature" });
    }

    // Fetch live status from Xodo
    try {
      const liveDoc = await getDocument(doc.esign_document_hash);

      // Map Xodo status
      let esignStatus = "waiting";
      if (liveDoc.is_completed) esignStatus = "signed";
      else if (liveDoc.is_cancelled) esignStatus = "cancelled";

      const signerUpdates = liveDoc.signers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        status: s.declined ? "declined" : s.signed ? "signed" : "waiting_for_signature",
        signed: !!s.signed,
        signed_at: s.signed_timestamp ? new Date(s.signed_timestamp * 1000).toISOString() : null,
      }));

      // Check if any signer declined
      if (liveDoc.signers.some((s) => s.declined)) {
        esignStatus = "declined";
      }

      // Update our DB with latest status
      const updates: Record<string, unknown> = {
        esign_status: esignStatus,
        esign_signers: signerUpdates,
      };

      if (esignStatus === "signed" && !doc.esign_completed_at) {
        updates.esign_completed_at = new Date(liveDoc.completed * 1000).toISOString();
        updates.signed_at = new Date(liveDoc.completed * 1000).toISOString();
        updates.status = "signed";
      } else if (esignStatus === "declined") {
        updates.status = "draft"; // Reset to draft if declined
      }

      await supabase.from("generated_documents").update(updates).eq("id", id);

      return NextResponse.json({
        esign_status: esignStatus,
        esign_sent_at: doc.esign_sent_at,
        esign_completed_at: updates.esign_completed_at || doc.esign_completed_at,
        signers: signerUpdates,
      });
    } catch {
      // If Xodo API fails, return cached data
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

// DELETE /api/pm/docgen/[id]/esign — Cancel eSign request
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("esign_document_hash, esign_status")
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

    // Cancel in Xodo
    await cancelDocument(doc.esign_document_hash);

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
      details: { document_hash: doc.esign_document_hash },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel" },
      { status: 500 }
    );
  }
}
