import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAuth,
  buildContext,
  toNextResponse,
  handleRouteError,
  parseBody,
} from "@/backend/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    const body = await parseBody(request);
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return toNextResponse({
        success: false,
        status: 400,
        error: "Current and new password are required",
      });
    }
    const ctx = buildContext(request, auth);
    const c = getControllers();
    return toNextResponse(
      await c.auth.changePassword(
        auth.userId,
        currentPassword as string,
        newPassword as string,
        ctx,
      ),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
