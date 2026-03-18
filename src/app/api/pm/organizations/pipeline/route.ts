import { NextResponse } from "next/server";
import { getOrganizationsByPipeline } from "@/lib/queries";

// GET /api/pm/organizations/pipeline — list orgs grouped by pipeline stage
export async function GET() {
  try {
    const grouped = await getOrganizationsByPipeline();
    return NextResponse.json(grouped);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
