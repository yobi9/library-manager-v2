import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, requireAuth, parseBody, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const auth = parseAuthFromRequest(request);
    const { mediaId } = await params;
    const c = getControllers();
    if (auth) {
      return toNextResponse(await c.progress.getOne(auth.userId, mediaId));
    }
    return toNextResponse({ success: true, status: 200, data: null });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const auth = requireAuth(request);
    const { mediaId } = await params;
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(await c.progress.upsert(auth.userId, mediaId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}