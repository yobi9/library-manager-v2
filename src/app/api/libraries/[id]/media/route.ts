import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, getQueryParam, getQueryNumber, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = parseAuthFromRequest(request);
    const c = getControllers();
    return toNextResponse(await c.media.getLibraryMedia(id, {
      rootOnly: getQueryParam(request, "rootOnly") ?? "",
      sortBy: getQueryParam(request, "sortBy") ?? "",
      sortOrder: getQueryParam(request, "sortOrder") ?? "",
      limit: String(getQueryNumber(request, "limit", 50) ?? 50),
      offset: String(getQueryNumber(request, "offset", 0) ?? 0),
      cursor: getQueryParam(request, "cursor") ?? "",
      year: getQueryParam(request, "year") ?? "",
      genre: getQueryParam(request, "genre") ?? "",
      certification: getQueryParam(request, "certification") ?? "",
      search: getQueryParam(request, "search") ?? "",
    }, auth ?? undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}