import { Resend } from "resend";
import { getBranding, buildEmailFrom, buildEmailFooterHtml } from "./branding";
import type { ResolvedBranding } from "@/types/pm";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

// ─── Task Assignment Notification ────────────────────────────────────────────

export async function sendTaskAssignmentEmail({
  to,
  taskName,
  projectName,
  assignedBy,
  dueDate,
  description,
  orgId,
}: {
  to: string;
  taskName: string;
  projectName?: string | null;
  assignedBy?: string;
  dueDate?: string | null;
  description?: string | null;
  orgId?: string | null;
}) {
  const r = getResend();
  if (!r) {
    console.log(`[Email] Resend not configured — skipping task notification to ${to}`);
    return null;
  }

  const branding = await getBranding(orgId);
  const from = buildEmailFrom(branding);
  const footer = buildEmailFooterHtml(branding);

  const dueLine = dueDate ? `<p><strong>Due:</strong> ${dueDate}</p>` : "";
  const projectLine = projectName ? `<p><strong>Project:</strong> ${projectName}</p>` : "";
  const descLine = description ? `<p><strong>Details:</strong> ${description}</p>` : "";
  const assignedLine = assignedBy ? `<p>${assignedBy} assigned you a task.</p>` : `<p>You have been assigned a new task.</p>`;

  const loginUrl = branding.website_url ? `${branding.website_url}/my-tasks` : "#";

  const { data, error } = await r.emails.send({
    from,
    to,
    subject: `Task assigned: ${taskName}`,
    html: `
      <div style="font-family: ${branding.font_body}, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${branding.primary_color};">New Task Assignment</h2>
        ${assignedLine}
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; color: ${branding.text_on_light};">${taskName}</h3>
          ${projectLine}
          ${dueLine}
          ${descLine}
        </div>
        <p style="color: #64748b; font-size: 14px;">
          <a href="${loginUrl}" style="color: ${branding.secondary_color};">View in ${branding.agency_name}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        ${footer}
      </div>
    `,
  });

  if (error) {
    console.error(`[Email] Failed to send task notification to ${to}:`, error);
    return null;
  }

  console.log(`[Email] Task notification sent to ${to}, id: ${data?.id}`);
  return data;
}

// ─── User Invite Email ──────────────────────────────────────────────────────

export async function sendInviteEmail({
  to,
  displayName,
  role,
  invitedBy,
  orgId,
}: {
  to: string;
  displayName: string;
  role: string;
  invitedBy?: string;
  orgId?: string | null;
}) {
  const r = getResend();
  if (!r) {
    console.log(`[Email] Resend not configured — skipping invite to ${to}`);
    return null;
  }

  const branding = await getBranding(orgId);
  const from = buildEmailFrom(branding);
  const footer = buildEmailFooterHtml(branding);
  const loginUrl = branding.website_url ? `${branding.website_url}/login` : "#";

  const inviterLine = invitedBy
    ? `<p>${invitedBy} has invited you to join ${branding.agency_name}.</p>`
    : `<p>You've been invited to join ${branding.agency_name}.</p>`;

  const { data, error } = await r.emails.send({
    from,
    to,
    subject: `You're invited to ${branding.email_from_name}`,
    html: `
      <div style="font-family: ${branding.font_body}, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${branding.primary_color};">Welcome, ${displayName}!</h2>
        ${inviterLine}
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Role:</strong> ${role}</p>
          <p>You can sign in to start managing projects, tasks, and collaborate with your team.</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${loginUrl}"
             style="background: ${branding.secondary_color}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Sign In to ${branding.email_from_name}
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        ${footer}
      </div>
    `,
  });

  if (error) {
    console.error(`[Email] Failed to send invite to ${to}:`, error);
    return null;
  }

  console.log(`[Email] Invite sent to ${to}, id: ${data?.id}`);
  return data;
}

// ─── Branded Email (generic, with branding) ──────────────────────────────────

export async function sendBrandedEmail({
  to,
  subject,
  bodyHtml,
  orgId,
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  orgId?: string | null;
}) {
  const r = getResend();
  if (!r) {
    console.log(`[Email] Resend not configured — skipping email to ${to}`);
    return null;
  }

  const branding = await getBranding(orgId);
  const from = buildEmailFrom(branding);
  const footer = buildEmailFooterHtml(branding);

  const html = `
    <div style="font-family: ${branding.font_body}, sans-serif; max-width: 600px; margin: 0 auto;">
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      ${footer}
    </div>
  `;

  const { data, error } = await r.emails.send({ from, to, subject, html });
  if (error) {
    console.error(`[Email] Failed to send to ${to}:`, error);
    return null;
  }
  return data;
}

// ─── Generic Email (backward compat — no branding lookup) ───────────────────

export async function sendEmail({
  to,
  subject,
  html,
  branding,
}: {
  to: string;
  subject: string;
  html: string;
  branding?: ResolvedBranding | null;
}) {
  const r = getResend();
  if (!r) {
    console.log(`[Email] Resend not configured — skipping email to ${to}`);
    return null;
  }

  const from = branding
    ? buildEmailFrom(branding)
    : `BusinessOS PM <admin@foundationstoneadvisors.com>`;

  const { data, error } = await r.emails.send({ from, to, subject, html });
  if (error) {
    console.error(`[Email] Failed to send to ${to}:`, error);
    return null;
  }
  return data;
}
