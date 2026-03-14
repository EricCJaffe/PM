import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// AUTH DISABLED — all routes are public until closer to go-live.
// The full auth middleware is preserved in git history for when we re-enable it.
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
