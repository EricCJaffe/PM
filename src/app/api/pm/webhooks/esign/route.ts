import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateWebhookHash, type EsignWebhookPayload } from "@/lib/esign";

/**
 * POST /api/pm/webhooks/esign — Xodo Sign webhook receiver
 *
 * Configure this URL in Xodo Sign Developer Settings > Webhooks:
 *   https://pm.foundationstoneadvisors.com/api/pm/webhooks/esign
 *
 * Events handled:
 *   document_signed    — A signer completed their signature
 *   document_completed — All signers have signed
 *   document_declined  — A signer declined
 *   document_cancelled — Document was cancelled
 *   document_expired   — Document expired before completion
 */
export async function POST(request: NextRequest) {
  try {
    const payload: EsignWebhookPayload = await request.json();
    const { event_time, event_type, event_hash, meta, signer } = payload;

    // Validate webhook authenticity
    const isValid = await validateWebhookHash(event_time, event_type, event_hash);
    if (!isValid) {
      console.error("Invalid eSign webhook hash");
      return NextResponse.json({ error: "Invalid hash" }, { status: 401 });
    }

    const documentHash = meta?.related_document_hash;
    if (!documentHash) {
      return NextResponse.json({ ok: true }); // Ignore events without a document
    }

    const supabase = createServiceClient();

    // Find our document by the Xodo document hash
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("id, esign_signers, esign_status")
      .eq("esign_document_hash", documentHash)
      .single();

    if (docErr || !doc) {
      console.warn(`eSign webhook: no document found for hash ${documentHash}`);
      return NextResponse.json({ ok: true }); // Return 200 anyway so Xodo doesn't retry
    }

    const updates: Record<string, unknown> = {};
    const signers = (doc.esign_signers || []) as Array<Record<string, unknown>>;

    switch (event_type) {
      case "document_signed": {
        // Update individual signer status
        if (signer) {
          const signerId = parseInt(signer.id, 10);
          for (const s of signers) {
            if (s.id === signerId) {
              s.status = "signed";
              s.signed = true;
              s.signed_at = new Date(event_time * 1000).toISOString();
            }
          }
          updates.esign_signers = signers;
        }
        break;
      }

      case "document_completed": {
        // All signers done
        updates.esign_status = "signed";
        updates.esign_completed_at = new Date(event_time * 1000).toISOString();
        updates.signed_at = new Date(event_time * 1000).toISOString();
        updates.status = "signed";
        // Mark all signers as signed
        for (const s of signers) {
          s.status = "signed";
          s.signed = true;
        }
        updates.esign_signers = signers;
        break;
      }

      case "document_declined": {
        updates.esign_status = "declined";
        updates.status = "draft";
        if (signer) {
          const signerId = parseInt(signer.id, 10);
          for (const s of signers) {
            if (s.id === signerId) {
              s.status = "declined";
            }
          }
          updates.esign_signers = signers;
        }
        break;
      }

      case "document_cancelled":
      case "document_revoked": {
        updates.esign_status = "cancelled";
        updates.status = "draft";
        break;
      }

      case "document_expired": {
        updates.esign_status = "expired";
        break;
      }

      default:
        // document_viewed, document_sent, etc. — log but don't change status
        break;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("generated_documents").update(updates).eq("id", doc.id);
    }

    // Log all webhook events as activity
    await supabase.from("document_activity").insert({
      document_id: doc.id,
      action: `esign_${event_type}`,
      details: {
        event_type,
        event_time,
        signer: signer ? { name: signer.name, email: signer.email } : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("eSign webhook error:", err);
    // Always return 200 to prevent Xodo retries on our errors
    return NextResponse.json({ ok: true });
  }
}
