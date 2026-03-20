import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-auth";

// GET /api/pm/api-keys — list all API keys (admin only)
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_api_keys")
    .select("id, name, key_prefix, permissions, org_scope, created_by, last_used_at, expires_at, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/pm/api-keys — create a new API key
export async function POST(request: NextRequest) {
  const { name, permissions, org_scope, created_by, expires_at } = await request.json();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_api_keys")
    .insert({
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions: permissions || {
        read: ["orgs", "projects", "members", "phases", "tasks", "notes"],
        write: ["tasks", "notes"],
      },
      org_scope: org_scope || null,
      created_by: created_by || null,
      expires_at: expires_at || null,
    })
    .select("id, name, key_prefix, permissions, org_scope, created_by, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the raw key ONCE — it cannot be retrieved again
  return NextResponse.json({ ...data, raw_key: rawKey }, { status: 201 });
}

// DELETE /api/pm/api-keys — revoke a key
export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("pm_api_keys")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
