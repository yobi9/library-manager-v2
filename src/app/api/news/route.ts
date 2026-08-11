import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError, getQueryParam, parseBody } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const c = getControllers();
    const published = getQueryParam(request, "published");
    if (published === "true") {
      return toNextResponse(await c.news.getAllPublished());
    }
    const limit = getQueryParam(request, "limit");
    const offset = getQueryParam(request, "offset");
    return toNextResponse(await c.news.getAll(limit, offset));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(await c.news.create(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
