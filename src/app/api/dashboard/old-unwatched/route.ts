import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  getQueryNumber,
  getQueryParam,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const daysOld = getQueryNumber(request, "daysOld", 30);
    const limit = getQueryNumber(request, "limit", 10);
    const onlyAvailable = getQueryParam(request, "onlyAvailable") !== "false";
    const c = getControllers();
    return toNextResponse(
      await c.dashboard.getOldUnwatched(
        String(daysOld ?? 30),
        String(limit ?? 10),
        String(onlyAvailable),
      ),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
