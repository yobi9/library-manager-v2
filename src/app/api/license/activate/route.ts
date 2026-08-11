import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  parseBody,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    const { license } = getControllers();
    return toNextResponse(await license.activate(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
