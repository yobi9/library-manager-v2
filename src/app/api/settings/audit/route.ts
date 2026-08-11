import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  getQueryNumber,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const c = getControllers();
    const limit = getQueryNumber(request, "limit", 50);
    return toNextResponse(await c.settings.getAuditLog(limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
