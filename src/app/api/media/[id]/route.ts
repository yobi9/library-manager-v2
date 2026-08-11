import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAuth,
  requireAdmin,
  parseBody,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.media.getMediaById(id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.media.deleteItem(id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(await c.media.updateMedia(id, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
