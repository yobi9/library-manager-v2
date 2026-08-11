import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, parseBody, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET() {
  try {
    const c = getControllers();
    return toNextResponse(await c.library.getAll());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(await c.library.create(body));
  } catch (error) {
    return handleRouteError(error);
  }
}