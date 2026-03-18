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

export interface EsignCreateFromHtmlRequest {
  html: string;
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
 * Uses POST /submissions/html (Pro feature).
 * DocuSeal converts the HTML to PDF and adds a signature page.
 */
export async function createSubmissionFromHtml(
  req: EsignCreateFromHtmlRequest
): Promise<EsignSubmitterResponse[]> {
  const { apiUrl } = getConfig();

  const body = {
    html: req.html,
    name: req.name,
    send_email: req.send_email !== false,
    order: req.order || "preserved",
    submitters: req.submitters.map((s) => ({
      name: s.name,
      email: s.email,
      role: s.role || "Signer",
      send_email: s.send_email !== false,
      values: s.values || {},
    })),
    ...(req.message && { message: { body: req.message } }),
    ...(req.expire_at && { expire_at: req.expire_at }),
  };

  const res = await fetch(`${apiUrl}/submissions/html`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSeal API error (${res.status}): ${err}`);
  }

  return (await res.json()) as EsignSubmitterResponse[];
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
