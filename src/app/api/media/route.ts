import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  getQueryParam,
  getQueryNumber,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const adminList = getQueryParam(request, "admin");
    const c = getControllers();
    if (adminList === "true") {
      requireAdmin(request);
      const page = getQueryNumber(request, "page", 1);
      const limit = getQueryNumber(request, "limit", 50);
      const params: Record<string, string> = {
        page: String(page ?? 1),
        limit: String(limit ?? 50),
        rootOnly: getQueryParam(request, "rootOnly") ?? "true",
        excludeTypes:
          getQueryParam(request, "excludeTypes") ?? "season,episode,series_sports,series_deen",
        admin: "true",
      };
      const search = getQueryParam(request, "search");
      const libraryId = getQueryParam(request, "libraryId");
      const type = getQueryParam(request, "type");
      const filterBy = getQueryParam(request, "filterBy");
      if (search) params["search"] = search;
      if (libraryId) params["libraryId"] = libraryId;
      if (type) params["type"] = type;
      if (filterBy) params["filterBy"] = filterBy;
      return toNextResponse(await c.media.getMediaByFilter(params));
    }
    const type = getQueryParam(request, "type");
    const limit = getQueryNumber(request, "limit", 24);
    return toNextResponse(await c.media.getLatest(type, String(limit ?? 24)));
  } catch (error) {
    return handleRouteError(error);
  }
}
