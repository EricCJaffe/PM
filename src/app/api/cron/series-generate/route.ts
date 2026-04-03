import { NextRequest, NextResponse } from "next/server";

// POST /api/cron/series-generate — Vercel Cron, daily at midnight UTC
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${appUrl}/api/pm/series/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ horizon: 14 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown" }));
    return NextResponse.json({ error: err.error ?? "Generate failed" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
