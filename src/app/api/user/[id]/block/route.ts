import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, parseBody, buildContext, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    const ctx = buildContext(request, auth);
    const c = getControllers();
    return toNextResponse(await c.user.block(id, body["block"] as boolean, ctx));
  } catch (error) {
    return handleRouteError(error);
  }
}
