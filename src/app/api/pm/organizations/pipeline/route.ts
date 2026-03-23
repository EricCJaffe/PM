import { NextResponse } from "next/server";
import { getOrganizationsByPipeline, getPipelineRevenue } from "@/lib/queries";

// GET /api/pm/organizations/pipeline — list orgs grouped by pipeline stage + revenue
export async function GET() {
  try {
    const [grouped, revenue] = await Promise.all([
      getOrganizationsByPipeline(),
      getPipelineRevenue(),
    ]);
    return NextResponse.json({ stages: grouped, revenue });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
