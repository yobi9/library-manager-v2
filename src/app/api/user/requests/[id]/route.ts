import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(_request);
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.visitor.deleteRequest(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
