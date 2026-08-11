import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { viewerResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const c = getControllers();
    return viewerResponse(await c.media.getPerson(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
