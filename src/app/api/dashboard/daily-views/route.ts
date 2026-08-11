import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, getQueryNumber, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const days = getQueryNumber(request, "days", 30);
    const c = getControllers();
    return toNextResponse(await c.dashboard.getDailyViews(String(days ?? 30)));
  } catch (error) {
    return handleRouteError(error);
  }
}
