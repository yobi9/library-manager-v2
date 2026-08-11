import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const c = getControllers();
    return toNextResponse(await c.user.getSystemStats());
  } catch (error) {
    return handleRouteError(error);
  }
}
