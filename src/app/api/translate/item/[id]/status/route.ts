import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    return toNextResponse(await getControllers().translation.getTranslationStatus(Number(id)));
  } catch (error) {
    return handleRouteError(error);
  }
}
