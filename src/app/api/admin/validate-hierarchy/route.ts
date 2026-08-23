import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, handleRouteError } from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const { scan } = getControllers();
    return toNextResponse(await scan.validateHierarchy());
  } catch (error) {
    return handleRouteError(error);
  }
}
