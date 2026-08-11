import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    requireAdmin(request);
    const { name } = await params;
    const c = getControllers();
    return toNextResponse(await c.database.downloadBackup(name));
  } catch (error) {
    return handleRouteError(error);
  }
}
