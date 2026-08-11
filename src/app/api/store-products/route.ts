import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError, getQueryParam, parseBody } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const c = getControllers();
    const categories = getQueryParam(request, "categories");
    if (categories === "true") {
      return toNextResponse(await c.storeProducts.getCategories());
    }
    const limit = getQueryParam(request, "limit");
    const offset = getQueryParam(request, "offset");
    const category = getQueryParam(request, "category");
    const activeOnly = getQueryParam(request, "active");
    return toNextResponse(await c.storeProducts.getAll(limit, offset, category, activeOnly));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(await c.storeProducts.create(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
