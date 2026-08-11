import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  parseBody,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    const c = getControllers();
    return toNextResponse(
      await c.visitor.addReplyToRequest(id, body["reply"] as string),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
