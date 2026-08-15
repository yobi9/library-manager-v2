import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  buildContext,
  toNextResponse,
  handleRouteError,
  parseBody,
} from "@/backend/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request);
    const body = await parseBody(request);
    const ctx = buildContext(request, auth);
    return toNextResponse(await getControllers().enrichment.updateApiKey(body, ctx.userId, ctx.ip));
  } catch (error) {
    return handleRouteError(error);
  }
}
