import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.library.getAgeRatings(id));
  } catch (error) {
    return handleRouteError(error);
  }
}