import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    return toNextResponse(await getControllers().enrichment.getStats());
  } catch (error) {
    return handleRouteError(error);
  }
}
