import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function POST(request: NextRequest) {
  const { project_id, name, group, status } = await request.json();
  if (!project_id || !name) return NextResponse.json({ error: "project_id and name required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: max } = await supabase
    .from("pm_phases").select("phase_order").eq("project_id", project_id)
    .order("phase_order", { ascending: false }).limit(1).single();

  const phase_order = ((max?.phase_order as number) ?? 0) + 1;
  const { data, error } = await supabase.from("pm_phases").insert({
    project_id, name, slug: slugify(name), phase_order,
    group: group ?? null, status: status ?? "not-started", progress: 0,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
