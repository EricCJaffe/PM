import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// POST /api/pm/client-update/[id]/send
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authClient = await createServerSupabase();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Load the draft note
  const { data: note, error } = await supabase
    .from("pm_client_notes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  if (note.status === "sent") {
    return NextResponse.json({ error: "Already sent" }, { status: 400 });
  }

  if (!note.sent_to_email) {
    return NextResponse.json({ error: "No recipient email on draft" }, { status: 400 });
  }

  // Send via Resend
  const emailResult = await sendEmail({
    to: note.sent_to_email,
    subject: note.subject ?? note.title,
    html: buildEmailHtml(note.sent_to_name ?? "there", note.body ?? "", note.title),
  });

  if (!emailResult) {
    return NextResponse.json(
      { error: "Email send failed — check RESEND_API_KEY" },
      { status: 500 }
    );
  }

  // Mark as sent
  const { data: updated } = await supabase
    .from("pm_client_notes")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  return NextResponse.json({
    sent: true,
    sent_at: updated?.sent_at,
    sent_to: note.sent_to_email,
  });
}

function buildEmailHtml(
  clientName: string,
  body: string,
  projectName: string
): string {
  const htmlBody = body
    .split("\n\n")
    .filter((p) => p.trim())
    .map(
      (p) =>
        `<p style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;margin:0 0 16px">${p.trim()}</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#1c2b1e;padding:20px 32px">
            <p style="font-family:sans-serif;font-size:11px;color:#7a9070;margin:0 0 4px;letter-spacing:.1em;text-transform:uppercase">Project Update</p>
            <p style="font-family:Georgia,serif;font-size:20px;color:#e8dfc8;margin:0">${escHtml(projectName)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            ${htmlBody}
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
