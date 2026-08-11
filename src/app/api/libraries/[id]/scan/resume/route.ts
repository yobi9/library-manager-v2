import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, handleRouteError } from "@/backend/api/route-helpers";
import { ScanController } from "@/backend/controllers/scan-controller";
import { getServices } from "@/backend/services";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const s = getServices();
    const controller = new ScanController(s.scanner, s.library);
    return toNextResponse(await controller.resumeScan(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
