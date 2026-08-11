import { getControllers } from "@/backend/controllers";
import { viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET() {
  try {
    const c = getControllers();
    return viewerResponse(await c.media.getPinnedItems());
  } catch (error) {
    return handleRouteError(error);
  }
}
