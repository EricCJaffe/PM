/**
 * DocuSeal API client for sending documents for digital signature.
 *
 * Env vars required:
 *   DOCUSEAL_API_KEY  — API key from DocuSeal settings
 *
 * Optional:
 *   DOCUSEAL_API_URL  — Base URL (default: https://api.docuseal.com, use your own for self-hosted)
 */

function getConfig() {
  const apiKey = process.env.DOCUSEAL_API_KEY;
  const apiUrl = process.env.DOCUSEAL_API_URL || "https://api.docuseal.com";

  if (!apiKey) {
    throw new Error("DOCUSEAL_API_KEY environment variable is required");
  }

  return { apiKey, apiUrl };
}

function headers(): Record<string, string> {
  const { apiKey } = getConfig();
  return {
    "X-Auth-Token": apiKey,
    "Content-Type": "application/json",
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EsignSubmitter {
  name: string;
  email: string;
  role?: string;
  phone?: string;
  values?: Record<string, string>;
  send_email?: boolean;
}

export interface EsignDocument {
  name: string;
  html: string;
}

export interface EsignCreateFromHtmlRequest {
  html?: string;
  documents?: EsignDocument[];
  name: string;
  submitters: EsignSubmitter[];
  order?: "preserved" | "random";
  send_email?: boolean;
  message?: string;
  expire_at?: string;
}

export interface EsignSubmitterResponse {
  id: number;
  uuid: string;
  email: string;
  slug: string;
  name: string;
  status: "pending" | "completed" | "declined" | "expired";
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  embed_src: string;
}

export interface EsignSubmissionResponse {
  id: number;
  submitters: EsignSubmitterResponse[];
  template: { id: number; name: string };
  status: "pending" | "completed" | "declined" | "expired";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  source: string;
  audit_log_url: string;
  documents: Array<{ name: string; url: string }>;
}

export interface EsignWebhookPayload {
  event_type: "submission.created" | "submission.completed" | "submission.expired" | "form.started" | "form.viewed" | "form.completed" | "form.declined";
  timestamp: string;
  data: {
    id: number;
    submission_id: number;
    email: string;
    name: string;
    status: string;
    sent_at: string | null;
    completed_at: string | null;
    declined_at: string | null;
    values: Array<{ field: string; value: string }>;
    documents: Array<{ name: string; url: string }>;
    audit_log_url: string;
    submission: {
      id: number;
      submitters: Array<{
        id: number;
        name: string;
        email: string;
        status: string;
        completed_at: string | null;
      }>;
    };
  };
}

// ─── API Methods ────────────────────────────────────────────────────────────

/**
 * Create a submission from raw HTML and send for signature.
 * Uses POST /submissions/html.
 * DocuSeal converts the HTML to PDF and renders field tags as interactive fields.
 *
 * Field tags supported in HTML:
 *   <signature-field name="..." role="..."></signature-field>
 *   <date-field name="..." role="..."></date-field>
 *   <text-field name="..." role="..." style="width: Xpx; ..."></text-field>
 *   <initials-field name="..." role="..."></initials-field>
 */
export async function createSubmissionFromHtml(
  req: EsignCreateFromHtmlRequest
): Promise<EsignSubmitterResponse[]> {
  const { apiUrl } = getConfig();

  // DocuSeal API expects documents as an array of {name, html}
  const documents: EsignDocument[] = req.documents || [
    { name: req.name, html: req.html || "" },
  ];

  const body: Record<string, unknown> = {
    name: req.name,
    documents,
    send_email: req.send_email !== false,
    order: req.order || "preserved",
    submitters: req.submitters.map((s) => ({
      name: s.name,
      email: s.email,
      role: s.role || "Signer",
      send_email: s.send_email !== false,
      values: s.values || {},
    })),
  };

  if (req.message) body.message = { body: req.message };
  if (req.expire_at) body.expire_at = req.expire_at;

  const res = await fetch(`${apiUrl}/submissions/html`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSeal API error (${res.status}): ${err}`);
  }

  const data = await res.json();

  // DocuSeal may return either:
  //   - An array of submitter objects (flat format)
  //   - A single submission object with a submitters array inside
  //   - A single submitter object (single signer)
  if (Array.isArray(data)) {
    return data as EsignSubmitterResponse[];
  }
  if (data.submitters && Array.isArray(data.submitters)) {
    return data.submitters as EsignSubmitterResponse[];
  }
  // Single object — wrap in array
  return [data] as EsignSubmitterResponse[];
}

/**
 * Inject DocuSeal field tags into the signature block of compiled HTML.
 *
 * Replaces the static signature block (sig-line / sig-name / sig-date elements)
 * with DocuSeal's custom HTML field tags so the platform knows where to render
 * interactive signature, date, and name fields for each signer.
 *
 * @param html - The compiled HTML document
 * @param clientName - Client signer name (pre-filled)
 * @param clientRole - DocuSeal role name for the client submitter
 * @param providerName - Provider signer name (pre-filled, optional)
 * @param providerRole - DocuSeal role name for the provider submitter (optional)
 */
export function injectSignatureFields(
  html: string,
  clientName: string,
  clientRole: string,
  providerName?: string,
  providerRole?: string
): string {
  // Build the client signature column with DocuSeal field tags
  const clientCol = `
        <div class="sig-col">
          <p class="sig-label">Client</p>
          <signature-field name="Client Signature" role="${clientRole}" required="true" style="width: 100%; height: 60px; display: block;"></signature-field>
          <text-field name="Client Name" role="${clientRole}" required="true" style="width: 200px; height: 18px; display: inline-block;" readonly="true">${escapeFieldValue(clientName)}</text-field>
          <date-field name="Client Date Signed" role="${clientRole}" required="true" style="width: 140px; height: 18px; display: inline-block;"></date-field>
        </div>`;

  // Build the provider signature column (if provider is a signer)
  const pName = providerName || "Foundation Stone Advisors";
  const pRole = providerRole || "Provider";
  const providerCol = `
        <div class="sig-col">
          <p class="sig-label">Foundation Stone Advisors</p>
          <signature-field name="Provider Signature" role="${pRole}" required="true" style="width: 100%; height: 60px; display: block;"></signature-field>
          <text-field name="Provider Name" role="${pRole}" required="true" style="width: 200px; height: 18px; display: inline-block;" readonly="true">${escapeFieldValue(pName)}</text-field>
          <date-field name="Provider Date Signed" role="${pRole}" required="true" style="width: 140px; height: 18px; display: inline-block;"></date-field>
        </div>`;

  // Replace the entire signature block with DocuSeal-tagged version.
  // The block structure is: <div class="signature-block">...nested divs...</div>
  // We match greedily to the last closing </div> before the next major section or </body>.
  const sigBlockStart = html.indexOf('<div class="signature-block">');

  const newSigBlock = `<div class="signature-block">
      <div class="section-divider"></div>
      <h2>Authorization</h2>
      <p class="sig-intro">By signing below, both parties agree to the terms outlined in this document.</p>
      <div class="sig-row">
${clientCol}
${providerCol}
      </div>
    </div>`;

  if (sigBlockStart !== -1) {
    // Find the matching closing </div> by counting nested divs
    let depth = 0;
    let i = sigBlockStart;
    let endPos = -1;
    while (i < html.length) {
      if (html.startsWith("<div", i)) {
        depth++;
        i += 4;
      } else if (html.startsWith("</div>", i)) {
        depth--;
        if (depth === 0) {
          endPos = i + 6; // past "</div>"
          break;
        }
        i += 6;
      } else {
        i++;
      }
    }
    if (endPos !== -1) {
      return html.slice(0, sigBlockStart) + newSigBlock + html.slice(endPos);
    }
  }

  // If no signature block found, append before </body>
  return html.replace("</body>", `${newSigBlock}\n</body>`);
}

function escapeFieldValue(val: string): string {
  return val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Get a submission by ID with full details.
 */
export async function getSubmission(submissionId: number): Promise<EsignSubmissionResponse> {
  const { apiUrl } = getConfig();

  const res = await fetch(`${apiUrl}/submissions/${submissionId}`, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSeal API error (${res.status}): ${err}`);
  }

  return (await res.json()) as EsignSubmissionResponse;
}

/**
 * Archive (cancel) a submission.
 */
export async function archiveSubmission(submissionId: number): Promise<void> {
  const { apiUrl } = getConfig();

  const res = await fetch(`${apiUrl}/submissions/${submissionId}`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSeal API error (${res.status}): ${err}`);
  }
}

/**
 * Get the signed documents (PDFs) for a completed submission.
 */
export async function getSubmissionDocuments(
  submissionId: number,
  merge = true
): Promise<Array<{ name: string; url: string }>> {
  const { apiUrl } = getConfig();

  const url = `${apiUrl}/submissions/${submissionId}/documents${merge ? "?merge=true" : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Failed to get submission documents (${res.status})`);
  }

  const data = await res.json();
  return data.documents || data;
}

/**
 * Validate a DocuSeal webhook request using the shared secret header.
 * DocuSeal sends the secret as a custom header you configure.
 */
export function validateWebhookSecret(
  requestHeaders: Headers
): boolean {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!secret) return true; // No secret configured = skip validation

  const headerValue = requestHeaders.get("X-Docuseal-Secret");
  return headerValue === secret;
}
