import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, parseBody, handleRouteError } from "@/backend/api/route-helpers";
import { getServices } from "@/backend/services";
import { ScanController } from "@/backend/controllers/scan-controller";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    const s = getServices();
    const controller = new ScanController(s.scanner, s.library);
    return toNextResponse(await controller.startScan(id, {
      deepScan: body["deepScan"] as boolean ?? false,
      forceRescan: body["forceRescan"] as boolean ?? false,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
