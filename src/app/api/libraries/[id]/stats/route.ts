import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAuth, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAuth(request);
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.library.getStats(id));
  } catch (error) {
    return handleRouteError(error);
  }
}