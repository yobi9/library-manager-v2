import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { getQueryNumber, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  try {
    const { id, type } = await params;
    const limit = getQueryNumber(request, "limit", 20);
    const c = getControllers();
    return viewerResponse(await c.media.getRecommendations(id, type, String(limit ?? 20)));
  } catch (error) {
    return handleRouteError(error);
  }
}
