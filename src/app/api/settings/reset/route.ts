import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const c = getControllers();
    return toNextResponse(await c.settings.reset());
  } catch (error) {
    return handleRouteError(error);
  }
}
