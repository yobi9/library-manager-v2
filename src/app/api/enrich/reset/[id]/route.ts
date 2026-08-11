import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    return toNextResponse(await getControllers().enrichment.resetItemMetadata(Number(id)));
  } catch (error) {
    return handleRouteError(error);
  }
}
