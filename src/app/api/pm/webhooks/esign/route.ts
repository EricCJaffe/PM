import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateWebhookSecret, type EsignWebhookPayload } from "@/lib/esign";

/**
 * POST /api/pm/webhooks/esign — DocuSeal webhook receiver
 *
 * Configure in DocuSeal Settings > Webhooks:
 *   URL: https://pm.foundationstoneadvisors.com/api/pm/webhooks/esign
 *   Secret header: X-Docuseal-Secret = <your secret>
 *
 * Events handled:
 *   form.completed  — A submitter completed signing
 *   form.declined   — A submitter declined
 *   submission.completed — All submitters have signed
 *   submission.expired   — Submission expired
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    if (!validateWebhookSecret(request.headers)) {
      console.error("Invalid DocuSeal webhook secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: EsignWebhookPayload = await request.json();
    const { event_type, data } = payload;

    if (!data?.submission_id && !data?.submission?.id) {
      return NextResponse.json({ ok: true });
    }

    const submissionId = data.submission_id || data.submission?.id;
    const supabase = createServiceClient();

    // Find our document — we store the first submitter ID as esign_document_hash,
    // but we also need to check esign_metadata for the submitter IDs
    // Use a broad search: look for submission_id in the metadata
    const { data: docs, error: docErr } = await supabase
      .from("generated_documents")
      .select("id, esign_signers, esign_status, esign_metadata")
      .eq("esign_provider", "docuseal")
      .not("esign_document_hash", "is", null);

    if (docErr || !docs || docs.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Find the document whose submitter IDs include this submission's submitter
    const doc = docs.find((d: Record<string, unknown>) => {
      const meta = d.esign_metadata as Record<string, unknown> | null;
      const ids = (meta?.submitter_ids || []) as number[];
      return ids.includes(data.id) || ids.includes(submissionId);
    });

    if (!doc) {
      console.warn(`eSign webhook: no document found for submitter ${data.id} / submission ${submissionId}`);
      return NextResponse.json({ ok: true });
    }

    const updates: Record<string, unknown> = {};
    const signers = (doc.esign_signers || []) as Array<Record<string, unknown>>;

    switch (event_type) {
      case "form.completed": {
        // Individual submitter completed signing
        for (const s of signers) {
          if (s.id === data.id || s.email === data.email) {
            s.status = "signed";
            s.signed = true;
            s.signed_at = data.completed_at;
          }
        }
        updates.esign_signers = signers;
        break;
      }

      case "form.declined": {
        updates.esign_status = "declined";
        updates.status = "draft";
        for (const s of signers) {
          if (s.id === data.id || s.email === data.email) {
            s.status = "declined";
          }
        }
        updates.esign_signers = signers;
        break;
      }

      case "submission.completed": {
        // All submitters done
        updates.esign_status = "signed";
        updates.esign_completed_at = data.completed_at || new Date().toISOString();
        updates.signed_at = data.completed_at || new Date().toISOString();
        updates.status = "signed";
        for (const s of signers) {
          s.status = "signed";
          s.signed = true;
        }
        updates.esign_signers = signers;
        break;
      }

      case "submission.expired": {
        updates.esign_status = "expired";
        break;
      }

      default:
        break;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("generated_documents").update(updates).eq("id", doc.id);
    }

    // Log webhook event as activity
    await supabase.from("document_activity").insert({
      document_id: doc.id,
      action: `esign_${event_type}`,
      details: {
        event_type,
        submitter: data.email ? { name: data.name, email: data.email } : null,
        documents: data.documents || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("eSign webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}
