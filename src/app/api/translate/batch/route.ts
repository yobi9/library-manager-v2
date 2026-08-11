import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError, parseBody } from "@/backend/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    return toNextResponse(await getControllers().translation.translateBatch(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
