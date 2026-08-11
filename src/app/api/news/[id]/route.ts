import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError, parseBody } from "@/backend/api/route-helpers";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.news.getById(id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(await c.news.update(id, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.news.delete(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
