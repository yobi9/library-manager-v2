import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  buildContext,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request);
    const { id } = await params;
    const form = await request.formData();
    const ctx = buildContext(request, auth);
    return toNextResponse(await getControllers().user.uploadAvatar(id, form, ctx));
  } catch (error) {
    return handleRouteError(error);
  }
}
