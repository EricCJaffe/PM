import { createServiceClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

export interface ApiKeyInfo {
  id: string;
  name: string;
  permissions: { read?: string[]; write?: string[] };
  org_scope: string[] | null;
  created_by: string | null;
}

/**
 * Validate an API key from the Authorization header.
 * Returns key metadata if valid, null if invalid/missing.
 */
export async function validateApiKey(authHeader: string | null): Promise<ApiKeyInfo | null> {
  if (!authHeader?.startsWith("Bearer pm_key_")) return null;

  const rawKey = authHeader.slice(7); // strip "Bearer "
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_api_keys")
    .select("id, name, permissions, org_scope, created_by, expires_at, is_active")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) return null;
  if (!data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Update last_used_at (fire and forget)
  supabase
    .from("pm_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    id: data.id,
    name: data.name,
    permissions: data.permissions ?? { read: [], write: [] },
    org_scope: data.org_scope,
    created_by: data.created_by,
  };
}

/**
 * Check if an API key has permission for a specific resource and action.
 */
export function hasPermission(key: ApiKeyInfo, action: "read" | "write", resource: string): boolean {
  const perms = key.permissions[action] ?? [];
  return perms.includes("*") || perms.includes(resource);
}

/**
 * Check if an API key has access to a specific org.
 */
export function hasOrgAccess(key: ApiKeyInfo, orgId: string): boolean {
  if (!key.org_scope) return true; // null = all orgs
  return key.org_scope.includes(orgId);
}

/**
 * Generate a new API key and return both the raw key (show once) and the hash (store).
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const rawKey = `pm_key_${hex}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 15) + "...";
  return { rawKey, keyHash, keyPrefix };
}
