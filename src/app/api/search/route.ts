import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { getQueryParam, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const c = getControllers();
    return viewerResponse(await c.search.search({
      q: getQueryParam(request, "q") ?? "",
      type: getQueryParam(request, "type") ?? "",
      libraryId: getQueryParam(request, "libraryId") ?? "",
      year: getQueryParam(request, "year") ?? "",
      page: getQueryParam(request, "page") ?? "1",
      limit: getQueryParam(request, "limit") ?? "20",
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}