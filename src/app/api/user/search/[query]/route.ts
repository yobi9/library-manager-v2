import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ query: string }> },
) {
  try {
    requireAdmin(request);
    const { query } = await params;
    const c = getControllers();
    return toNextResponse(await c.user.search(query));
  } catch (error) {
    return handleRouteError(error);
  }
}
