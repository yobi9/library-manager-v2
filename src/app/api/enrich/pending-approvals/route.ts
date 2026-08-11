import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, getQueryParam, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const limit = getQueryParam(request, "limit");
    return toNextResponse(await getControllers().enrichment.getPendingApprovals(limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
