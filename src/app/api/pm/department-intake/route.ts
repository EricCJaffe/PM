import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/pm/department-intake?workflow_id=...&org_id=...
 * List department intake forms for a workflow or org.
 */
export async function GET(request: NextRequest) {
  const workflowId = request.nextUrl.searchParams.get("workflow_id");
  const orgId = request.nextUrl.searchParams.get("org_id");

  if (!workflowId && !orgId) {
    return NextResponse.json({ error: "workflow_id or org_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  let query = supabase
    .from("pm_department_intake")
    .select("*, pm_departments(id, name, slug, head_name, head_email)")
    .order("created_at");

  if (workflowId) query = query.eq("workflow_id", workflowId);
  if (orgId) query = query.eq("org_id", orgId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
