import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// POST /api/pm/proposals/[id]/send — send proposal via email + mark as sent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json().catch(() => ({}));
    const { to, subject, message } = body as {
      to?: string;
      subject?: string;
      message?: string;
    };

    // Load proposal + org info
    const { data: proposal, error: pErr } = await supabase
      .from("pm_proposals")
      .select("*, pm_organizations(name, contact_name, contact_email)")
      .eq("id", id)
      .single();

    if (pErr || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // If email details provided, send the email
    if (to) {
      const shareUrl = proposal.share_token
        ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://pm.foundationstoneadvisors.com"}/proposals/view/${proposal.share_token}`
        : null;

      const emailSubject = subject || `Proposal: ${proposal.title}`;
      const emailHtml = buildProposalEmail({
        recipientName: proposal.pm_organizations?.contact_name || "",
        orgName: proposal.pm_organizations?.name || "",
        proposalTitle: proposal.title,
        message: message || "",
        shareUrl,
      });

      const emailResult = await sendEmail({ to, subject: emailSubject, html: emailHtml });
      if (!emailResult) {
        return NextResponse.json(
          { error: "Email send failed — check RESEND_API_KEY" },
          { status: 500 }
        );
      }
    }

    // Mark proposal as sent
    const { data, error } = await supabase
      .from("pm_proposals")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

function buildProposalEmail({
  recipientName,
  orgName,
  proposalTitle,
  message,
  shareUrl,
}: {
  recipientName: string;
  orgName: string;
  proposalTitle: string;
  message: string;
  shareUrl: string | null;
}): string {
  const greeting = recipientName ? `Hi ${escHtml(recipientName)},` : "Hello,";

  const messageHtml = message
    ? message
        .split("\n\n")
        .filter((p) => p.trim())
        .map(
          (p) =>
            `<p style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;margin:0 0 16px">${escHtml(p.trim())}</p>`
        )
        .join("")
    : `<p style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;margin:0 0 16px">Please find our proposal attached below for your review.</p>`;

  const viewButton = shareUrl
    ? `<div style="text-align:center;margin:24px 0">
        <a href="${shareUrl}" style="background:#3b82f6;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-family:sans-serif;font-size:15px;font-weight:600;display:inline-block">
          View Proposal
        </a>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#1c2b1e;padding:20px 32px">
            <p style="font-family:sans-serif;font-size:11px;color:#7a9070;margin:0 0 4px;letter-spacing:.1em;text-transform:uppercase">Proposal</p>
            <p style="font-family:Georgia,serif;font-size:20px;color:#e8dfc8;margin:0">${escHtml(proposalTitle)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;margin:0 0 16px">${greeting}</p>
            ${messageHtml}
            ${viewButton}
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
            <p style="font-family:sans-serif;font-size:12px;color:#999;margin:0">
              Foundation Stone Advisors &middot; Reply to this email with any questions
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
