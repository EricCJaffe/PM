import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getResolvedVocab } from "@/lib/queries";

/** GET: Resolved vocabulary labels for an org (base terms merged with overrides) */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  const departmentId = request.nextUrl.searchParams.get("department_id");

  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const vocab = await getResolvedVocab(orgId, departmentId ?? undefined);
  return NextResponse.json(vocab);
}

/** POST: Set or update vocabulary overrides */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, department_id, overrides } = body;

    if (!org_id || !overrides || !Array.isArray(overrides)) {
      return NextResponse.json(
        { error: "org_id and overrides[] are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Upsert each override
    const results = [];
    for (const override of overrides) {
      const { base_term, display_label, description, sort_order } = override;
      if (!base_term || !display_label) continue;

      const { data, error } = await supabase
        .from("pm_department_vocab")
        .upsert(
          {
            org_id,
            department_id: department_id ?? null,
            base_term,
            display_label,
            description: description ?? null,
            sort_order: sort_order ?? 0,
          },
          { onConflict: "org_id,COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),base_term" }
        )
        .select()
        .single();

      if (error) {
        // If upsert on composite fails, try delete + insert
        await supabase
          .from("pm_department_vocab")
          .delete()
          .eq("org_id", org_id)
          .eq("base_term", base_term)
          .is("department_id", department_id ?? null);

        const { data: inserted, error: insertErr } = await supabase
          .from("pm_department_vocab")
          .insert({
            org_id,
            department_id: department_id ?? null,
            base_term,
            display_label,
            description: description ?? null,
            sort_order: sort_order ?? 0,
          })
          .select()
          .single();

        if (insertErr) {
          results.push({ base_term, error: insertErr.message });
        } else {
          results.push(inserted);
        }
      } else {
        results.push(data);
      }
    }

    return NextResponse.json({ overrides: results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
