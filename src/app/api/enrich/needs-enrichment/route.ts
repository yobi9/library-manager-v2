import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, getQueryParam, getQueryNumber, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    return toNextResponse(await getControllers().enrichment.getItemsNeedingEnrichment({
      limit: getQueryParam(request, "limit"),
      offset: getQueryParam(request, "offset"),
      libraryId: getQueryParam(request, "libraryId"),
      type: getQueryParam(request, "type"),
      onlyEmpty: getQueryParam(request, "onlyEmpty"),
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
