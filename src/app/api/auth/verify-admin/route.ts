import { NextRequest, NextResponse } from "next/server";
import { parseAuthFromRequest } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  const auth = parseAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ valid: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ valid: false, error: "ADMIN_REQUIRED" }, { status: 403 });
  }
  return NextResponse.json({ valid: true, user: { id: auth.userId, username: auth.username } });
}
