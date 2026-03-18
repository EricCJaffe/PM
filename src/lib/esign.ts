/**
 * Xodo Sign (eversign) API client for sending documents for digital signature.
 *
 * Env vars required:
 *   EVERSIGN_ACCESS_KEY  — API access key from Xodo Sign developer settings
 *   EVERSIGN_BUSINESS_ID — Business ID (usually "1" for primary business)
 *
 * Optional:
 *   EVERSIGN_SANDBOX     — Set to "1" to create sandbox (non-binding) documents
 */

const BASE_URL = "https://api.eversign.com/api";

function getConfig() {
  const accessKey = process.env.EVERSIGN_ACCESS_KEY;
  const businessId = process.env.EVERSIGN_BUSINESS_ID || "1";
  const sandbox = process.env.EVERSIGN_SANDBOX === "1" ? 1 : 0;

  if (!accessKey) {
    throw new Error("EVERSIGN_ACCESS_KEY environment variable is required");
  }

  return { accessKey, businessId, sandbox };
}

function buildUrl(path: string): string {
  const { accessKey, businessId } = getConfig();
  return `${BASE_URL}/${path}?access_key=${accessKey}&business_id=${businessId}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EsignSigner {
  id: number;
  name: string;
  email: string;
  order?: number;
  message?: string;
}

export interface EsignCreateRequest {
  title: string;
  message: string;
  fileBase64: string;
  fileName: string;
  signers: EsignSigner[];
  useSignerOrder?: boolean;
  reminders?: boolean;
}

export interface EsignDocumentResponse {
  document_hash: string;
  title: string;
  is_completed: number;
  is_draft: number;
  is_cancelled: number;
  is_deleted: number;
  created: number;
  completed: number;
  expires: number;
  signers: Array<{
    id: number;
    name: string;
    email: string;
    signed: number;
    signed_timestamp: number;
    status: string;
    declined: number;
  }>;
}

export interface EsignWebhookPayload {
  event_time: number;
  event_type: string;
  event_hash: string;
  meta: {
    related_document_hash: string;
    related_user_id: string;
    related_business_id: string;
  };
  signer?: {
    id: string;
    name: string;
    email: string;
    role: string;
    order: string;
  };
}

// ─── API Methods ────────────────────────────────────────────────────────────

/**
 * Create and send a document for signature via Xodo Sign.
 * The document is sent as base64-encoded content (HTML or PDF).
 * If no signature fields are specified, Xodo auto-appends a signature page.
 */
export async function createDocument(req: EsignCreateRequest): Promise<EsignDocumentResponse> {
  const { sandbox } = getConfig();

  const body = {
    sandbox,
    title: req.title,
    message: req.message,
    is_draft: 0,
    use_signer_order: req.useSignerOrder ? 1 : 0,
    reminders: req.reminders !== false ? 1 : 0,
    files: [
      {
        name: req.fileName,
        file_base64: req.fileBase64,
      },
    ],
    signers: req.signers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      order: s.order ?? s.id,
      message: s.message ?? "",
    })),
    // No fields array = Xodo auto-appends signature page per signer
  };

  const res = await fetch(buildUrl("document"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xodo Sign API error (${res.status}): ${err}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Xodo Sign error: ${JSON.stringify(data.error)}`);
  }

  return data as EsignDocumentResponse;
}

/**
 * Get the current status of a document from Xodo Sign.
 */
export async function getDocument(documentHash: string): Promise<EsignDocumentResponse> {
  const res = await fetch(
    buildUrl("document") + `&document_hash=${documentHash}`,
    { method: "GET" }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xodo Sign API error (${res.status}): ${err}`);
  }

  return (await res.json()) as EsignDocumentResponse;
}

/**
 * Cancel a document that is pending signature.
 */
export async function cancelDocument(documentHash: string): Promise<void> {
  const res = await fetch(
    buildUrl("document") + `&document_hash=${documentHash}&cancel=1`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xodo Sign API error (${res.status}): ${err}`);
  }
}

/**
 * Download the final signed PDF from Xodo Sign.
 * Returns the PDF as an ArrayBuffer.
 */
export async function downloadSignedPdf(documentHash: string): Promise<ArrayBuffer> {
  const res = await fetch(
    buildUrl("download_final_document") + `&document_hash=${documentHash}`,
    { method: "GET" }
  );

  if (!res.ok) {
    throw new Error(`Failed to download signed PDF (${res.status})`);
  }

  return res.arrayBuffer();
}

/**
 * Validate a webhook event_hash using HMAC-SHA256.
 * hash = HMAC-SHA256(event_time + event_type, access_key)
 */
export async function validateWebhookHash(
  eventTime: number,
  eventType: string,
  eventHash: string
): Promise<boolean> {
  const { accessKey } = getConfig();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(accessKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${eventTime}${eventType}`)
  );
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === eventHash;
}
