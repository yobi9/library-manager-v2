import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const formData = await request.formData();
    const uploaded = formData.get("backup");
    const file = uploaded instanceof File ? uploaded : null;
    const c = getControllers();
    return toNextResponse(await c.database.restore(file));
  } catch (error) {
    return handleRouteError(error);
  }
}
