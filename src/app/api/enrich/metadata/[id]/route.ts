import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError, parseBody } from "@/backend/api/route-helpers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    return toNextResponse(await getControllers().enrichment.updateMetadataManually(Number(id), body));
  } catch (error) {
    return handleRouteError(error);
  }
}
