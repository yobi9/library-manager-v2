import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { getQueryNumber, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const libraryId = getQueryNumber(request, "libraryId");
    const c = getControllers();
    return viewerResponse(await c.media.getAvailableYears(libraryId != null ? String(libraryId) : undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}