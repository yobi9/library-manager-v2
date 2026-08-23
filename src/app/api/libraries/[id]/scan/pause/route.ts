import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, handleRouteError } from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const { scan } = getControllers();
    return toNextResponse(await scan.pauseScan(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
