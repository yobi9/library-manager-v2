import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, getQueryNumber, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  try {
    const { id, type } = await params;
    const auth = parseAuthFromRequest(request);
    const limit = getQueryNumber(request, "limit", 20);
    const c = getControllers();
    return viewerResponse(await c.media.getRecommendations(id, type, String(limit ?? 20), auth ?? undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}
