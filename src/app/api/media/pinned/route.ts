import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const auth = parseAuthFromRequest(request);
    const c = getControllers();
    return viewerResponse(await c.media.getPinnedItems(auth ?? undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}
