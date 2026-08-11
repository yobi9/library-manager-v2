import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { getQueryParam, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const c = getControllers();
    return viewerResponse(await c.media.getMediaByFilter({
      year: getQueryParam(request, "year") ?? "",
      genre: getQueryParam(request, "genre") ?? "",
      certification: getQueryParam(request, "certification") ?? "",
      minRating: getQueryParam(request, "minRating") ?? "",
      rootOnly: getQueryParam(request, "rootOnly") ?? "",
      page: getQueryParam(request, "page") ?? "",
      limit: getQueryParam(request, "limit") ?? "",
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
