import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, getQueryParam, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const auth = parseAuthFromRequest(request);
    const c = getControllers();
    return viewerResponse(await c.media.getMediaByFilter({
      year: getQueryParam(request, "year") ?? "",
      genre: getQueryParam(request, "genre") ?? "",
      certification: getQueryParam(request, "certification") ?? "",
      minRating: getQueryParam(request, "minRating") ?? "",
      rootOnly: getQueryParam(request, "rootOnly") ?? "",
      page: getQueryParam(request, "page") ?? "",
      limit: getQueryParam(request, "limit") ?? "",
    }, auth ?? undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}
