import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  toNextResponse,
  handleRouteError,
  getQueryParam,
  parseBody,
} from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const c = getControllers();
    const limit = getQueryParam(request, "limit");
    const offset = getQueryParam(request, "offset");
    const type = getQueryParam(request, "type");
    const status = getQueryParam(request, "status");
    const userId = getQueryParam(request, "userId");
    return toNextResponse(await c.messages.getAll(limit, offset, type, status, userId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(await c.messages.create(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
