import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAuth, getQueryNumber, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAuth(request);
    const { id } = await params;
    const limit = getQueryNumber(request, "limit", 50);
    const c = getControllers();
    return toNextResponse(await c.user.getActivity(id, String(limit ?? 50)));
  } catch (error) {
    return handleRouteError(error);
  }
}
