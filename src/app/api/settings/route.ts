import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  parseBody,
  buildContext,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function GET() {
  try {
    const c = getControllers();
    return toNextResponse(await c.settings.getPublic());
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
    return toNextResponse(await c.settings.update(body, ctx.userId, ctx.ip));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAdmin(request);
    const body = await parseBody(request);
    const ctx = buildContext(request, auth);
    const c = getControllers();
    return toNextResponse(await c.settings.update(body, ctx.userId, ctx.ip));
  } catch (error) {
    return handleRouteError(error);
  }
}
