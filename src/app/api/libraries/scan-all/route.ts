import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, parseBody, handleRouteError } from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    const { scan } = getControllers();
    return toNextResponse(await scan.scanAll({
      deepScan: body["deepScan"] as boolean ?? false,
      forceRescan: body["forceRescan"] as boolean ?? false,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
