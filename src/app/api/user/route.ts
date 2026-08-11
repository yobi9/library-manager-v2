import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, parseBody, getQueryNumber, buildContext, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const limit = getQueryNumber(request, "limit", 50);
    const offset = getQueryNumber(request, "offset", 0);
    const c = getControllers();
    return toNextResponse(await c.user.getAll(String(limit ?? 50), String(offset ?? 0)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request);
    const body = await parseBody(request);
    const ctx = buildContext(request, auth);
    const c = getControllers();
    return toNextResponse(await c.user.create(body, ctx));
  } catch (error) {
    return handleRouteError(error);
  }
}
