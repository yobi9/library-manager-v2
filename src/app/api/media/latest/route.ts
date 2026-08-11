import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { getQueryParam, getQueryNumber, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const type = getQueryParam(request, "type");
    const limit = getQueryNumber(request, "limit", 24);
    const c = getControllers();
    return viewerResponse(await c.media.getLatest(type, String(limit ?? 24)));
  } catch (error) {
    return handleRouteError(error);
  }
}
