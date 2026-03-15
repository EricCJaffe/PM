import { NextRequest, NextResponse } from "next/server";
import { getAssignableMembers } from "@/lib/queries";
import { checkTablesExist } from "@/lib/db-check";

const REQUIRED_TABLES = ["pm_members", "pm_organizations"];

// GET /api/pm/members/assignable?org_id=xxx
// Returns site-org staff + target org members (for owner picker dropdowns)
export async function GET(request: NextRequest) {
  const tableCheck = await checkTablesExist(REQUIRED_TABLES);
  if (tableCheck) {
    return NextResponse.json(tableCheck, { status: 503 });
  }

  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!orgId) {
    return NextResponse.json({ error: "org_id query param is required" }, { status: 400 });
  }

  try {
    const members = await getAssignableMembers(orgId);
    return NextResponse.json(members);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
