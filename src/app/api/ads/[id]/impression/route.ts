import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.ads.recordImpression(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
