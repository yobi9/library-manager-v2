import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, parseBody, handleRouteError } from "@/backend/api/route-helpers";
import { ScanController } from "@/backend/controllers/scan-controller";
import { getServices } from "@/backend/services";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    const s = getServices();
    const controller = new ScanController(s.scanner, s.library);
    return toNextResponse(await controller.scanAll({
      deepScan: body["deepScan"] as boolean ?? false,
      forceRescan: body["forceRescan"] as boolean ?? false,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
