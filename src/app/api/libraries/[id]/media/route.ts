import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { getQueryParam, getQueryNumber, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.media.getLibraryMedia(id, {
      rootOnly: getQueryParam(request, "rootOnly") ?? "",
      sortBy: getQueryParam(request, "sortBy") ?? "",
      sortOrder: getQueryParam(request, "sortOrder") ?? "",
      limit: String(getQueryNumber(request, "limit", 50) ?? 50),
      offset: String(getQueryNumber(request, "offset", 0) ?? 0),
      year: getQueryParam(request, "year") ?? "",
      genre: getQueryParam(request, "genre") ?? "",
      certification: getQueryParam(request, "certification") ?? "",
      search: getQueryParam(request, "search") ?? "",
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}