import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    requireAdmin(request);
    const { sessionId } = await params;
    return toNextResponse(await getControllers().translation.cancelBatch(sessionId));
  } catch (error) {
    return handleRouteError(error);
  }
}
