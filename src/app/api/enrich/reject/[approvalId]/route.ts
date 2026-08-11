import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ approvalId: string }> }) {
  try {
    requireAdmin(request);
    const { approvalId } = await params;
    const body = await request.json().catch(() => ({}));
    return toNextResponse(await getControllers().enrichment.rejectEnrichment(Number(approvalId)));
  } catch (error) {
    return handleRouteError(error);
  }
}
