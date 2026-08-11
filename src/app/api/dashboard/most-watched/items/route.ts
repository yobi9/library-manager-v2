import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, getQueryNumber, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const limit = getQueryNumber(request, "limit", 10);
    const c = getControllers();
    return toNextResponse(await c.dashboard.getMostWatchedItems(String(limit ?? 10)));
  } catch (error) {
    return handleRouteError(error);
  }
}
