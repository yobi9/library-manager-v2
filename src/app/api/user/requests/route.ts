import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  parseBody,
  buildContext,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const c = getControllers();
    return toNextResponse(await c.visitor.getVisitorRequests());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const ctx = buildContext(request);
    const c = getControllers();
    return toNextResponse(
      await c.visitor.addVisitorRequest(body["userId"] as string, body["message"] as string, ctx),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireAdmin(request);
    const c = getControllers();
    return toNextResponse(await c.visitor.deleteAllRequests());
  } catch (error) {
    return handleRouteError(error);
  }
}
