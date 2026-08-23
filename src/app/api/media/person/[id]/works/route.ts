import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = parseAuthFromRequest(request);
    const c = getControllers();
    return viewerResponse(await c.media.getPersonWorks(id, auth ?? undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}
