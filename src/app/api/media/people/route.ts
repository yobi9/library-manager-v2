import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  getQueryParam,
  getQueryNumber,
  viewerResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const limit = getQueryNumber(request, "limit", 100);
    const search = getQueryParam(request, "search") ?? undefined;
    const c = getControllers();
    return viewerResponse(await c.media.getAllPeople(String(limit ?? 100), search));
  } catch (error) {
    return handleRouteError(error);
  }
}
