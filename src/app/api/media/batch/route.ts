import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { getQueryParam, viewerResponse, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const idsParam = getQueryParam(request, "ids");
    if (!idsParam) {
      return toNextResponse({ success: false, status: 400, error: "ids parameter required" });
    }
    const c = getControllers();
    return viewerResponse(await c.media.getMediaBatch(idsParam));
  } catch (error) {
    return handleRouteError(error);
  }
}
