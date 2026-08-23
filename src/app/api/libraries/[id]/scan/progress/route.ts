import { NextRequest } from "next/server";
import { toNextResponse, requireAuth, handleRouteError } from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAuth(request);
    const { id } = await params;
    const { scan } = getControllers();
    return toNextResponse(await scan.getProgress(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
