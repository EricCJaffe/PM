import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** POST /api/pm/series/[id]/exceptions — add skip or reschedule exception */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { exception_date, exception_type, reschedule_to, reason } = await request.json();

  if (!exception_date) return NextResponse.json({ error: "exception_date required" }, { status: 400 });
  if (!exception_type || !["skip", "reschedule"].includes(exception_type)) {
    return NextResponse.json({ error: "exception_type must be 'skip' or 'reschedule'" }, { status: 400 });
  }
  if (exception_type === "reschedule" && !reschedule_to) {
    return NextResponse.json({ error: "reschedule_to required for reschedule exceptions" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pm_series_exceptions")
    .insert({
      series_id: id,
      exception_date,
      exception_type,
      reschedule_to: reschedule_to ?? null,
      reason: reason ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("duplicate")) {
      return NextResponse.json({ error: "Exception already exists for this date" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If skipping, delete any existing unfinished instance for that date
  if (exception_type === "skip") {
    await supabase.from("pm_tasks").delete()
      .eq("series_id", id)
      .eq("series_occurrence_date", exception_date)
      .neq("status", "complete");
  }

  return NextResponse.json(data, { status: 201 });
}

/** DELETE /api/pm/series/[id]/exceptions — remove an exception */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { exception_id } = await request.json();

  if (!exception_id) return NextResponse.json({ error: "exception_id required" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("pm_series_exceptions")
    .delete().eq("id", exception_id).eq("series_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
