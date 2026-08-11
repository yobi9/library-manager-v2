import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, getQueryNumber, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const limit = getQueryNumber(request, "limit", 50);
    const offset = getQueryNumber(request, "offset", 0);
    const c = getControllers();
    return toNextResponse(await c.user.getVisitorLogs(String(limit ?? 50), String(offset ?? 0)));
  } catch (error) {
    return handleRouteError(error);
  }
}
