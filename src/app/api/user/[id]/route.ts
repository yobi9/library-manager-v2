import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAuth, requireAdmin, parseBody, buildContext, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAuth(request);
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.user.getById(id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    const ctx = buildContext(request, auth);
    const c = getControllers();
    return toNextResponse(await c.user.update(id, body, ctx));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAdmin(request);
    const { id } = await params;
    const ctx = buildContext(request, auth);
    const c = getControllers();
    return toNextResponse(await c.user.delete(id, ctx));
  } catch (error) {
    return handleRouteError(error);
  }
}
