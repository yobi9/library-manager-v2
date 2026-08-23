import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, getQueryParam, getQueryNumber, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const q = getQueryParam(request, "q") ?? "";
    const limit = getQueryNumber(request, "limit", 8);
    const auth = parseAuthFromRequest(request);
    const c = getControllers();
    return viewerResponse(await c.search.liveSearch(q, String(limit ?? 8), auth ?? undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}