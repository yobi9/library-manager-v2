import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const auth = parseAuthFromRequest(request);
    const c = getControllers();
    if (auth) {
      return toNextResponse(await c.progress.getAll(auth.userId));
    }
    return toNextResponse({ success: true, status: 200, data: [] });
  } catch (error) {
    return handleRouteError(error);
  }
}