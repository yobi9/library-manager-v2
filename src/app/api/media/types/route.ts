import { getControllers } from "@/backend/controllers";
import { toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET() {
  try {
    const c = getControllers();
    return toNextResponse(await c.media.getMediaTypes());
  } catch (error) {
    return handleRouteError(error);
  }
}
