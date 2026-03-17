import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM_EMAIL = "BusinessOS PM <admin@foundationstoneadvisors.com>";

// ─── Task Assignment Notification ────────────────────────────────────────────

export async function sendTaskAssignmentEmail({
  to,
  taskName,
  projectName,
  assignedBy,
  dueDate,
  description,
}: {
  to: string;
  taskName: string;
  projectName?: string | null;
  assignedBy?: string;
  dueDate?: string | null;
  description?: string | null;
}) {
  const r = getResend();
  if (!r) {
    console.log(`[Email] Resend not configured — skipping task notification to ${to}`);
    return null;
  }

  const dueLine = dueDate ? `<p><strong>Due:</strong> ${dueDate}</p>` : "";
  const projectLine = projectName ? `<p><strong>Project:</strong> ${projectName}</p>` : "";
  const descLine = description ? `<p><strong>Details:</strong> ${description}</p>` : "";
  const assignedLine = assignedBy ? `<p>${assignedBy} assigned you a task.</p>` : `<p>You have been assigned a new task.</p>`;

  const { data, error } = await r.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Task assigned: ${taskName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b;">New Task Assignment</h2>
        ${assignedLine}
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; color: #0f172a;">${taskName}</h3>
          ${projectLine}
          ${dueLine}
          ${descLine}
        </div>
        <p style="color: #64748b; font-size: 14px;">
          <a href="https://pm.foundationstoneadvisors.com/my-tasks" style="color: #3b82f6;">View in BusinessOS PM</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">Foundation Stone Advisors — Project Management</p>
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
}: {
  to: string;
  displayName: string;
  role: string;
  invitedBy?: string;
}) {
  const r = getResend();
  if (!r) {
    console.log(`[Email] Resend not configured — skipping invite to ${to}`);
    return null;
  }

  const inviterLine = invitedBy
    ? `<p>${invitedBy} has invited you to join BusinessOS PM.</p>`
    : `<p>You've been invited to join BusinessOS PM.</p>`;

  const { data, error } = await r.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "You're invited to BusinessOS PM",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Welcome, ${displayName}!</h2>
        ${inviterLine}
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Role:</strong> ${role}</p>
          <p>You can sign in to start managing projects, tasks, and collaborate with your team.</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://pm.foundationstoneadvisors.com/login"
             style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Sign In to BusinessOS PM
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">Foundation Stone Advisors — Project Management</p>
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

// ─── Generic Email ──────────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const r = getResend();
  if (!r) {
    console.log(`[Email] Resend not configured — skipping email to ${to}`);
    return null;
  }

  const { data, error } = await r.emails.send({ from: FROM_EMAIL, to, subject, html });
  if (error) {
    console.error(`[Email] Failed to send to ${to}:`, error);
    return null;
  }
  return data;
}
