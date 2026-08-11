import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError, getQueryParam, parseBody } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const c = getControllers();
    const activeOnly = getQueryParam(request, "active");
    if (activeOnly === "true") {
      const position = getQueryParam(request, "position");
      return toNextResponse(await c.ads.getActive(position));
    }
    const limit = getQueryParam(request, "limit");
    const offset = getQueryParam(request, "offset");
    return toNextResponse(await c.ads.getAll(limit, offset));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(await c.ads.create(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
